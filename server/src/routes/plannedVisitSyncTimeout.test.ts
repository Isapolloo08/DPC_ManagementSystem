import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import {db,pool} from '../db/schema';
import {JWT_SECRET} from '../middleware/auth';
import {plannedVisitSync} from '../services/plannedVisitSync';
import {SyncError} from '../services/invitationSync';
import {requestTimeout} from '../middleware/requestTimeout';
import router from './plannedVisitSync';

for (const outcome of ['success','failure'] as const) {
 test(`preview ${outcome} after HTTP timeout does not write a second response`,async t=>{
  t.mock.method(db,'get',async()=>({id:1,role_id:1,role_name:'Admin',name:'Admin'}));
  t.mock.method(db,'all',async()=>[]);
  let expire:()=>void;
  let release:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(plannedVisitSync,'preview',async()=>{
   expire();
   await pending;
   if(outcome==='failure')throw new SyncError('Online service unavailable.',503);
   return {submission:'fixture'};
  });
  let lateWrites=0;
  const app=express();app.use(express.json());
  app.use((_req,res,next)=>{
   res.setTimeout=((_ms:number,callback:()=>void)=>{expire=callback;return res;}) as typeof res.setTimeout;
   const json=res.json.bind(res);
   res.json=((body:unknown)=>{if(res.headersSent)lateWrites++;return json(body);}) as typeof res.json;
   next();
  });
  app.use(requestTimeout);app.use('/api/planned-visit-sync',router);
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try {
   const response=await fetch(base+'/api/planned-visit-sync/preview',{method:'POST',headers:{Authorization:'Bearer '+jwt.sign({id:1},JWT_SECRET),'Content-Type':'application/json'},body:JSON.stringify({submission:'fixture'})});
   assert.equal(response.status,504);
   await response.json();
   release!();
   await new Promise<void>(resolve=>setImmediate(resolve));
   assert.equal(lateWrites,0,'completed requests must not receive another JSON response');
   assert.equal((await fetch(base+'/api/planned-visit-sync/state')).status,401);
  } finally {
   release!();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
 });
}

test('planned visit sync timeout policy leaves room for remote errors and protects Pull commits',()=>{
 for(const [method,path,expected] of [
  ['POST','/api/planned-visit-sync/preview',60000],
  ['POST','/api/planned-visit-sync/refresh',60000],
  ['GET','/api/planned-visit-sync/state',60000],
  ['POST','/api/planned-visit-sync/pull',0],
  ['POST','/api/planned-visit-sync/pull/',0],
  ['GET','/api/planned-visit-sync/pull',60000],
  ['POST','/api/invitation-sync/pull',0],
  ['POST','/api/members',15000],
 ] as const) {
  let actual=-1;
  requestTimeout({method,path} as any,{setTimeout:(ms:number)=>{actual=ms;}} as any,()=>{});
  assert.equal(actual,expected,`${method} ${path}`);
 }
});

test('preview still returns normal success, service errors and revoked authorization',async t=>{
 let authorized=true;
 t.mock.method(db,'get',async()=>({id:1,role_id:1,role_name:'Admin',name:authorized?'Admin':'Coordinator'}));
 t.mock.method(db,'all',async()=>[]);
 let fail=false;
 t.mock.method(plannedVisitSync,'preview',async()=>{
  if(fail)throw new SyncError('Online service unavailable.',503);
  return {submission:'fixture'};
 });
 const app=express();app.use(express.json());app.use(requestTimeout);app.use('/api/planned-visit-sync',router);
 const server=app.listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 const url=`http://127.0.0.1:${(server.address() as any).port}/api/planned-visit-sync/preview`;
 const preview=()=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+jwt.sign({id:1},JWT_SECRET),'Content-Type':'application/json'},body:JSON.stringify({submission:'fixture'})});
 try {
  const success=await preview();assert.equal(success.status,200);assert.deepEqual(await success.json(),{submission:'fixture'});
  fail=true;const failure=await preview();assert.equal(failure.status,503);assert.deepEqual(await failure.json(),{error:'Online service unavailable.'});
  fail=false;authorized=false;const revoked=await preview();assert.equal(revoked.status,403);assert.deepEqual(await revoked.json(),{error:'Visit authorization expired.'});
 } finally {
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});

after(async()=>{await pool.end();});
