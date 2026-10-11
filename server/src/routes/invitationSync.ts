import { Router, RequestHandler } from 'express';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import { db } from '../db/schema';
import { invitationSync, SyncError, uuid, revision, digest } from '../services/invitationSync';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
const router = Router();
const handle=(fn:RequestHandler):RequestHandler => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(error=>{
  const status=error instanceof SyncError?error.status:503;
  res.status(status===401&&error instanceof SyncError&&error.message.startsWith('Reconnect required')?409:status).json({error:error instanceof SyncError?error.message:'Invitation synchronization is unavailable. No success was assumed.'});
});
const admin=[authMiddleware,requireRoles('Admin')];
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.post('/authorize',rateLimit({windowMs:60000,limit:10,standardHeaders:true,legacyHeaders:false}),handle(async(req,res)=>{
  if(typeof req.body.username!=='string'||typeof req.body.password!=='string'||req.body.password.length>512) throw new SyncError('Cloud Admin authorization required.',401);
  const user=await db.get(`SELECT u.id,u.password_hash,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(u.email)=lower($1) OR lower(u.username)=lower($1)`,[req.body.username]);
  if(!user||!['Admin','IT Admin'].includes(user.role_name)||!(await bcrypt.compare(req.body.password,user.password_hash))) throw new SyncError('Cloud Admin authorization required.',401);
  const node=await invitationSync.node();
  if(!req.body.receiver) {res.json({source:node.identity});return;}
  if(!uuid(req.body.receiver)||req.body.receiver===node.identity||req.body.expected_source!==node.identity) throw new SyncError('Verify the distinct source and receiver identities.',409);
  const credential='dpc_'+randomBytes(32).toString('hex');
  await db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(237024)');
    const existing=await client.query('SELECT receiver FROM invitation_sync_receivers WHERE receiver<>$1',[req.body.receiver]);
    if(existing.rowCount) throw new SyncError('This source is paired with another Local Master. Verify receiver recovery rather than creating an independent receiver.',409);
    await client.query('INSERT INTO invitation_sync_receivers(receiver,token_hash,created_by) VALUES($1,$2,$3) ON CONFLICT(receiver) DO UPDATE SET token_hash=EXCLUDED.token_hash,revoked=false,created_by=EXCLUDED.created_by',[req.body.receiver,digest(credential),user.id]);
    await client.query('UPDATE invitation_sync_node SET source_enabled=true WHERE id=1');
  });
  res.json({source:node.identity,credential});
}));
router.get('/source/identity',...admin,handle(async(_req,res)=>{const node=await invitationSync.node();res.json({source:node.identity});}));
router.post('/source/pair',...admin,handle(async(req:AuthRequest,res)=>{
  if(!uuid(req.body.receiver)) throw new SyncError('Invalid receiver identity.',400);
  const node=await invitationSync.node();
  if(req.body.receiver===node.identity) throw new SyncError('Receiver must use a separate Local Master.',409);
  const credential='dpc_'+randomBytes(32).toString('hex');
  await db.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(237024)');
    const existing=await client.query('SELECT receiver FROM invitation_sync_receivers WHERE receiver<>$1',[req.body.receiver]);
    if(existing.rowCount) throw new SyncError('This source is paired with another Local Master. Verify receiver recovery rather than creating an independent receiver.',409);
    await client.query('INSERT INTO invitation_sync_receivers(receiver,token_hash,created_by) VALUES($1,$2,$3) ON CONFLICT(receiver) DO UPDATE SET token_hash=EXCLUDED.token_hash,revoked=false,created_by=EXCLUDED.created_by',[req.body.receiver,digest(credential),req.user!.id]);
    await client.query('UPDATE invitation_sync_node SET source_enabled=true WHERE id=1');
  });
  res.json({source:node.identity,credential});
}));
router.post('/source/revoke',...admin,handle(async(req,res)=>{
  if(!uuid(req.body.receiver)) throw new SyncError('Invalid receiver identity.',400);
  await db.run('UPDATE invitation_sync_receivers SET revoked=true WHERE receiver=$1',[req.body.receiver]);res.json({revoked:true});
}));
const integration:RequestHandler=handle(async(req,res,next)=>{
  const token=req.headers.authorization?.replace(/^Bearer /,'')||'';
  if(!/^dpc_[a-f0-9]{64}$/.test(token)) throw new SyncError('Integration authorization required.',401);
  const node=await invitationSync.node(),receiver=req.get('X-Sync-Receiver');
  if(!uuid(receiver)||req.get('X-Sync-Source')!==node.identity) throw new SyncError('Source or receiver authorization mismatch.',403);
  const paired=await db.get('SELECT receiver FROM invitation_sync_receivers WHERE receiver=$1 AND token_hash=$2 AND NOT revoked',[receiver,digest(token)]);
  if(!paired) throw new SyncError('Integration authorization revoked or invalid.',401);
  res.locals.receiver=receiver;res.locals.source=node.identity;next();
});
router.use('/source',integration);
router.get('/source/metadata',handle(async(req,res)=>{
  const cursor=req.query.cursor;
  if(cursor!==undefined&&!uuid(cursor)) throw new SyncError('Invalid availability cursor.',400);
  const rows=await db.all(`SELECT r.sync_identity AS submission,r.sync_revision::text AS revision,e.sync_identity AS event_identity,e.title AS event_title,r.updated_at
    FROM event_invitation_responses r JOIN events e ON e.id=r.event_id
    WHERE ($1::uuid IS NULL OR r.sync_identity>$1::uuid) ORDER BY r.sync_identity LIMIT 101`,[cursor||null]);
  res.json({source:res.locals.source,items:rows.slice(0,100),next:rows.length>100?rows[99].submission:null});
}));
router.get('/source/submissions/:id',handle(async(req,res)=>{
  if(!uuid(req.params.id)) throw new SyncError('Invalid submission identity.',400);
  const row=await db.get(`SELECT r.sync_identity AS submission,r.sync_revision::text AS revision,r.name,r.contact,r.answer,r.reason,r.updated_at,
    e.sync_identity AS event_identity,i.sync_identity AS invitation_identity,m.sync_identity AS member_identity
    FROM event_invitation_responses r JOIN events e ON e.id=r.event_id JOIN event_invitation_links i ON i.id=r.invitation_id
    LEFT JOIN members m ON m.id=r.member_id WHERE r.sync_identity=$1`,[req.params.id]);
  if(!row) throw new SyncError('Submission unavailable. Resolve the source before retrying.',409);
  res.json({source:res.locals.source,...row});
}));
router.post('/source/confirm',handle(async(req,res)=>{
  if(!uuid(req.body.submission)||!revision(req.body.revision)) throw new SyncError('Invalid committed revision.',400);
  const current=await db.get('SELECT sync_revision::text AS revision FROM event_invitation_responses WHERE sync_identity=$1',[req.body.submission]);
  if(!current||BigInt(req.body.revision)>BigInt(current.revision)) throw new SyncError('Committed revision does not exist at this source.',409);
  await db.run('INSERT INTO invitation_sync_confirmations(receiver,submission,revision) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[res.locals.receiver,req.body.submission,req.body.revision]);
  res.json({source:res.locals.source,confirmed:true,submission:req.body.submission,revision:req.body.revision});
}));
router.use(authMiddleware, requireRoles('Admin'));
router.get('/state',handle(async(_req,res)=>{res.json(await invitationSync.state());}));
router.post('/inspect',handle(async(req,res)=>{const remote=await invitationSync.inspect(req.body);res.json({source:remote.source,origin:remote.origin});}));
router.post('/pair',handle(async(req,res)=>{res.json(await invitationSync.pair(req.body));}));
router.post('/refresh',handle(async(_req,res)=>{await invitationSync.refresh();res.json(await invitationSync.state());}));
router.post('/retry-confirmations',handle(async(_req,res)=>{await invitationSync.recoverConfirmations();res.json(await invitationSync.state());}));
router.post('/preview',handle(async(req:AuthRequest,res)=>{
  const preview=await invitationSync.preview(req.body.submission);
  if(!(await invitationSync.authorized(req.headers.authorization!,req.user!.id))) throw new SyncError('Admin authorization expired or revoked.',403);
  res.json(preview);
}));
router.post('/pull',handle(async(req:AuthRequest,res)=>{
  const ids=req.body.submissions;
  if(!Array.isArray(ids)||!ids.length||ids.length>25||!ids.every(uuid)||new Set(ids).size!==ids.length||!Number.isSafeInteger(req.body.event_id)||req.body.event_id<1) throw new SyncError('Select up to 25 distinct submissions within one event.',400);
  const results=[];const deadline=Date.now()+120000;
  for(const id of ids) {
    if(res.destroyed||Date.now()>deadline) break;
    // Revalidate JWT and role before each item; cancellation never undoes a commit.
    if(!(await invitationSync.authorized(req.headers.authorization!,req.user!.id))) break;
    try {results.push(await invitationSync.pull(id,req.body.event_id,req.user!.id,req.headers.authorization!));}
    catch(error) {results.push({submission:id,status:error instanceof SyncError&&error.status===409?'Blocked':'Failed',error:error instanceof SyncError?error.message:'Local import failed. Recheck durable status before retrying.'});}
  }
  res.json({results,unprocessed:ids.slice(results.length)});
}));
export default router;
