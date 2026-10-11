// Existing tests may initialize schema. Never point them at configured business databases.
const {Pool}=require('pg');
const {randomUUID}=require('crypto');
const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');
async function main(){
  const config={host:'127.0.0.1',port:5432,user:'postgres',password:process.env.TEST_POSTGRES_PASSWORD||'admin123',database:'postgres',connectionTimeoutMillis:3000};
  const admin=new Pool(config),name='dpc_suite_'+randomUUID().replace(/-/g,'');
  if(!/^dpc_suite_[a-f0-9]{32}$/.test(name))throw Error('Invalid disposable database name');
  let created=false;
  try{
    await admin.query(`CREATE DATABASE "${name}"`);created=true;
    const collect=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?collect(path.join(dir,item.name)):item.name.endsWith('.test.js')?[path.join(dir,item.name)]:[]);
    const files=process.argv.length>2?process.argv.slice(2).map(file=>path.resolve(file)):collect(path.resolve(__dirname,'../dist'));
    const connection=`postgres://postgres:${encodeURIComponent(config.password)}@127.0.0.1:5432/${name}`;
    const exit=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['--test','--test-concurrency=1',...files],{stdio:'inherit',env:{...process.env,DATABASE_URL:connection,DB_SSL:'false',NODE_ENV:'test'}});
      child.once('error',reject);child.once('exit',code=>resolve(code??1));
    });process.exitCode=exit;
  }finally{
    if(created){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[name]);await admin.query(`DROP DATABASE "${name}"`);}
    await admin.end();
  }
}
main().catch(()=>{console.error('Isolated test run could not complete; inspect preceding test output. No configured business database was used.');process.exitCode=1;});
