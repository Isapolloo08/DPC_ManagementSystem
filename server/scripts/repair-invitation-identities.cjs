// Explicit one-time repair of an already reviewed clone; never invoked by sync.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawn}=require('child_process');
const {Pool}=require('pg');
const dotenv=require('dotenv');

const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical=value=>JSON.stringify(value);
function planPairs(local,cloud,table,localUsers=[],cloudUsers=[]) {
  const result=[];
  for(const row of local) {
    if(cloud.some(other=>other.sync_identity===row.sync_identity))continue;
    const other=cloud.find(other=>other.id===row.id);
    if(!other)continue; // Truly new records do not require identity repair.
    if(local.some(item=>item.id!==row.id&&item.sync_identity===other.sync_identity))throw Error('Destination identity is already assigned locally.');
    const fields=Object.keys(row).filter(key=>key in other&&key!=='sync_identity'&&(table!=='events'||key!=='created_by'));
    if(fields.some(key=>canonical(row[key])!==canonical(other[key])))throw Error(`Ambiguous ${table} counterpart ${row.id}; shared fields differ.`);
    if(table==='events'&&row.created_by!==other.created_by) {
      const a=localUsers.find(u=>u.id===row.created_by),b=cloudUsers.find(u=>u.id===other.created_by);
      if(!a||!b||!((a.username&&a.username===b.username)||(a.email&&a.email===b.email)))throw Error(`Event ${row.id} creator provenance differs.`);
    }
    result.push({table,id:row.id,cloud_id:other.id,previous:row.sync_identity,identity:other.sync_identity,local_fingerprint:fingerprint(row),cloud_fingerprint:fingerprint(other)});
  }
  return result;
}
const clean=value=>(value||'').trim().replace(/^DATABASE_URL=/,'').replace(/^["']+|["']+$/g,'');
function connection(raw) {
  const url=new URL(clean(raw));
  const ssl=!['localhost','127.0.0.1'].includes(url.hostname)?{rejectUnauthorized:false}:undefined;
  for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])url.searchParams.delete(key);
  return {url,pool:new Pool({connectionString:url.href,ssl,max:1,connectionTimeoutMillis:15000})};
}
async function backup(url,file,key) {
  const executable=process.env.PG_DUMP_PATH||(process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe':'pg_dump');
  await new Promise((resolve,reject)=>{
    const child=spawn(executable,['--format=custom','--no-owner','--no-privileges','--schema=public','--file',file],{
      windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:['localhost','127.0.0.1'].includes(url.hostname)?'disable':'require',PGCONNECT_TIMEOUT:'15'}
    });
    child.stderr.resume();child.once('error',()=>reject(Error('Unable to start pg_dump.')));child.once('exit',code=>code===0?resolve():reject(Error('Database backup failed; repair not applied.')));
  });
  const bytes=fs.readFileSync(file);if(bytes.length<100||bytes.subarray(0,5).toString()!=='PGDMP')throw Error('Invalid database backup; repair not applied.');
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
  const header={version:1,algorithm:'aes-256-gcm',key_env:'INVITATION_SYNC_ENCRYPTION_KEY',iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),plain_sha256:fingerprint(bytes.toString('base64'))};
  const output=file+'.enc';fs.writeFileSync(output,Buffer.concat([Buffer.from(JSON.stringify(header)+'\n'),encrypted]),{flag:'wx'});
  // Verify recovery before removing this script's temporary plaintext dump.
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(cipher.getAuthTag());
  if(!Buffer.concat([decipher.update(encrypted),decipher.final()]).equals(bytes))throw Error('Backup recovery verification failed.');
  fs.unlinkSync(file);
  return {file:output,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')};
}
async function main() {
  const apply=process.argv.includes('--apply');
  const directory=process.argv.find(arg=>arg.startsWith('--directory='))?.slice(12);
  if(!directory||!path.isAbsolute(directory))throw Error('Provide an absolute --directory for the private repair plan and backups.');
  fs.mkdirSync(directory,{recursive:true});
  const env=dotenv.parse(fs.readFileSync(path.resolve(__dirname,'../.env')));
  const local=connection(env.DATABASE_URL);
  let cloud,l,c;
  try {
    l=await local.pool.connect();
    const setting=(await l.query("SELECT value FROM system_settings WHERE key='cloud_database_url'")).rows[0]?.value;
    cloud=connection(env.CLOUD_DATABASE_URL||env.SUPABASE_DATABASE_URL||setting);c=await cloud.pool.connect();
    if(apply) {
      await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='10s'");
      await c.query('SELECT pg_advisory_xact_lock(728194,1)');
      await c.query('LOCK TABLE members,events,users IN SHARE MODE');
      await l.query('BEGIN');await l.query("SET LOCAL lock_timeout='10s'");
      await l.query('SELECT pg_advisory_xact_lock(728194,1)');
      await l.query('SELECT pg_advisory_xact_lock(170017)');await l.query('SELECT pg_advisory_xact_lock(237024)');
      await l.query('LOCK TABLE members,events,users IN SHARE ROW EXCLUSIVE MODE');
    } else {await l.query('BEGIN READ ONLY');await c.query('BEGIN READ ONLY');}
    const read=(db,table)=>db.query(`SELECT * FROM ${table} ORDER BY id`).then(r=>r.rows);
    const lm=await read(l,'members'),cm=await read(c,'members'),le=await read(l,'events'),ce=await read(c,'events');
    const lu=await read(l,'users'),cu=await read(c,'users');
    const source=(await c.query('SELECT identity FROM invitation_sync_node WHERE id=1')).rows[0].identity;
    const receiver=(await l.query('SELECT identity,source_id FROM invitation_sync_node WHERE id=1')).rows[0];
    if(receiver.source_id!==source)throw Error('Paired invitation source is different from this cloud database. Repair requires separate provenance review.');
    const mappings=[...planPairs(lm,cm,'members'),...planPairs(le,ce,'events',lu,cu)];
    const proposal={version:1,source,receiver:receiver.identity,mappings,local_members:lm.length,cloud_members:cm.length};
    const planFile=path.join(directory,'repair-plan.json');
    if(!apply) {
      fs.writeFileSync(planFile,JSON.stringify(proposal,null,2),{flag:'wx'});
      console.log(JSON.stringify({plan:planFile,members:mappings.filter(p=>p.table==='members').length,events:mappings.filter(p=>p.table==='events').length,cloud_only_members:cm.filter(r=>!lm.some(x=>x.id===r.id||x.sync_identity===r.sync_identity)).length,read_only:true}));return;
    }
    const approved=JSON.parse(fs.readFileSync(planFile,'utf8'));
    if(fingerprint(approved)!==fingerprint(proposal))throw Error('Repair plan is stale; no changes applied.');
    const rawKey=env.INVITATION_SYNC_ENCRYPTION_KEY;
    if(!/^[a-f0-9]{64}$/i.test(rawKey||''))throw Error('Existing invitation encryption key is required to protect backups.');
    const key=Buffer.from(rawKey,'hex');
    const backups=[];
    console.log('Creating encrypted local backup...');backups.push(await backup(local.url,path.join(directory,'local-before.dump'),key));
    console.log('Creating encrypted cloud backup...');backups.push(await backup(cloud.url,path.join(directory,'cloud-before.dump'),key));
    fs.writeFileSync(path.join(directory,'backup-manifest.json'),JSON.stringify({created_at:new Date().toISOString(),backups,key_env:'INVITATION_SYNC_ENCRYPTION_KEY'},null,2),{flag:'wx'});
    for(const entry of mappings) {
      const changed=await l.query(`UPDATE ${entry.table} SET sync_identity=$1 WHERE id=$2 AND sync_identity=$3`,[entry.identity,entry.id,entry.previous]);
      if(changed.rowCount!==1)throw Error('Concurrent identity change; repair rolled back.');
      if(entry.table==='events') {
        await l.query('UPDATE invitation_sync_pending SET event_identity=$1 WHERE event_identity=$2 AND source=$3',[entry.identity,entry.previous,source]);
        await l.query('UPDATE notifications SET invitation_event_identity=$1 WHERE invitation_event_identity=$2',[entry.identity,entry.previous]);
      }
      await l.query("INSERT INTO audit_logs(user_id,action,target_table,target_id,details) VALUES(NULL,'REPAIR_INVITATION_IDENTITY',$1,$2,$3)",[entry.table,entry.id,JSON.stringify({previous:entry.previous,verified:entry.identity,source,plan_fingerprint:fingerprint(proposal),actor:'User-authorized one-time repair'})]);
    }
    await l.query('COMMIT');await c.query('ROLLBACK');
    fs.writeFileSync(path.join(directory,'repair-result.json'),JSON.stringify({applied_at:new Date().toISOString(),members:mappings.filter(p=>p.table==='members').length,events:mappings.filter(p=>p.table==='events').length,cloud_rows_changed:0,plan_fingerprint:fingerprint(proposal)},null,2),{flag:'wx'});
    console.log(JSON.stringify({applied:true,members:mappings.filter(p=>p.table==='members').length,events:mappings.filter(p=>p.table==='events').length,cloud_rows_changed:0,backups:backups.map(b=>b.file)}));
  } finally {
    for(const db of [l,c])if(db){await db.query('ROLLBACK').catch(()=>{});db.release();}
    await local.pool.end();if(cloud)await cloud.pool.end();
  }
}
module.exports={planPairs};
if(require.main===module)main().catch(error=>{console.error(error.message.startsWith('Ambiguous')||/repair|plan|backup|identity|source|directory/i.test(error.message)?error.message:'Repair could not complete. No credential details were logged.');process.exitCode=1;});
