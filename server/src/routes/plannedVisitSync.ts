import {Router,RequestHandler} from 'express';
import {authMiddleware,requireRoles,AuthRequest} from '../middleware/auth';
import {plannedVisitSync,visitAuthorized} from '../services/plannedVisitSync';
import {SyncError,uuid} from '../services/invitationSync';
const router=Router();
const handle=(fn:RequestHandler):RequestHandler=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(e=>res.status(e instanceof SyncError?e.status:503).json({error:e instanceof SyncError?e.message:'Visit synchronization unavailable; recheck durable status before retrying.'}));
router.use(authMiddleware,requireRoles('Admin','Pastor'));
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/state',handle(async(_req,res)=>{res.json(await plannedVisitSync.state());}));
router.post('/refresh',handle(async(_req,res)=>{await plannedVisitSync.recover();await plannedVisitSync.refresh();res.json(await plannedVisitSync.state());}));
router.post('/preview',handle(async(req:AuthRequest,res)=>{
 const preview=await plannedVisitSync.preview(req.body.submission);
 if(!await visitAuthorized(req.headers.authorization!,req.user!.id))throw new SyncError('Visit authorization expired.',403);
 res.json(preview);
}));
router.post('/pull',handle(async(req:AuthRequest,res)=>{
 const ids=req.body.submissions;
 if(!Array.isArray(ids)||!ids.length||ids.length>25||!ids.every(uuid)||new Set(ids).size!==ids.length)throw new SyncError('Select up to 25 distinct visits.',400);
 const results=[];const deadline=Date.now()+120000;
 for(const id of ids){
  if(res.destroyed||Date.now()>deadline||!await visitAuthorized(req.headers.authorization!,req.user!.id))break;
  try{results.push(await plannedVisitSync.pull(id,req.user!.id,req.headers.authorization!));}
  catch(e){results.push({submission:id,status:'Failed',error:e instanceof SyncError?e.message:'Import failed; recheck status before retrying.'});break;}
 }
 res.json({results,unprocessed:ids.slice(results.length)});
}));
export default router;
