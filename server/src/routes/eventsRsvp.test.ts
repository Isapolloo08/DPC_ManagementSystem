import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import {AddressInfo} from 'net';
import jwt from 'jsonwebtoken';
import router from './events';
import {db} from '../db/schema';
import {JWT_SECRET} from '../middleware/auth';

test('RSVP selects a real member, rejects missing selection, and preserves attendance on retries',async()=>{
  const config={host:'127.0.0.1',port:5432,user:'postgres',password:process.env.TEST_POSTGRES_PASSWORD||'admin123',database:'chms_db',connectionTimeoutMillis:2000};
  const admin=new Pool(config),schema='rsvp_'+randomUUID().replace(/-/g,'');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new Pool({...config,options:`-c search_path=${schema}`});
  const original={get:db.get,all:db.all,run:db.run};
  const app=express();app.use(express.json());app.use('/events',router);const server=app.listen(0);
  await new Promise<void>(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/events/501/rsvp`;
  try {
    for(const file of ['001_init_postgres.sql','022_event_ministries.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../db/migrations',file),'utf8'));
    await pool.query("INSERT INTO roles(id,name) VALUES(501,'Admin'),(502,'Member'); INSERT INTO users(id,name,email,password_hash,role_id) VALUES(501,'Admin','admin@fixture.test','fixture',501),(502,'Member','member@fixture.test','fixture',502)");
    await pool.query("INSERT INTO events(id,title,start_time,end_time) VALUES(501,'RSVP fixture','2099-01-01','2099-01-02'); INSERT INTO members(id,first_name,last_name,birthdate,status,user_id) VALUES(501,'Linked','Member','2000-01-01','active',502),(502,'Other','Member','2000-01-01','active',NULL)");
    db.get=(async(q:string,p:any[]) => (await pool.query(q,p)).rows[0]) as any;
    db.all=(async(q:string,p:any[]) => (await pool.query(q,p)).rows) as any;
    db.run=(async(q:string,p:any[]) => {const result=await pool.query(q,p);return {changes:result.rowCount};}) as any;
    const call=(id:number,body:any)=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+jwt.sign({id},JWT_SECRET,{expiresIn:'1h'}),'Content-Type':'application/json'},body:JSON.stringify(body)});
    const missing=await call(501,{});assert.equal(missing.status,400);assert.match((await missing.json() as any).error,/select.*member/i);
    assert.equal((await call(501,{member_id:502,status:'attended'})).status,400);
    assert.equal((await call(502,{member_id:502})).status,403);
    assert.equal((await call(501,{member_id:999})).status,404);
    assert.equal((await call(501,{member_id:502})).status,200);
    await Promise.all([call(501,{member_id:502}),call(501,{member_id:502})]);
    assert.equal((await pool.query('SELECT count(*)::int n FROM event_registrations')).rows[0].n,1);
    assert.equal((await call(502,{})).status,200);
    await pool.query("UPDATE event_registrations SET status='checked_in' WHERE member_id=502");
    const repeated=await call(501,{member_id:502});assert.equal((await repeated.json() as any).status,'checked_in');
    assert.equal((await pool.query('SELECT count(*)::int n FROM attendance')).rows[0].n,0);
  }finally{
    Object.assign(db,original);await new Promise<void>(r=>server.close(()=>r()));await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
  }
});
