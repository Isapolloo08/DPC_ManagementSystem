import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';

type Identity={submission:string;revision:string};
type Detail<T>={status:'Loading'|'Ready'|'Unavailable';data?:T};

/** Page-scoped previews only: never write personal information into metadata or storage. */
export function useOnlineSubmissionDetails<T extends Identity>(
 items:Identity[],context:string,authorized:boolean,load:(id:string)=>Promise<T>,
) {
 const {token}=useAuth();
 const [attempt,setAttempt]=useState(0);
 const key=JSON.stringify([authorized?token:null,context,items.map(p=>[p.submission,p.revision]),attempt]);
 const [state,setState]=useState<{key:string;rows:Record<string,Detail<T>>}>({key:'',rows:{}});
 useEffect(()=>{
  let cancelled=false,index=0;
  const rows=items.map(p=>({...p}));
  setState({key,rows:authorized?Object.fromEntries(rows.map(p=>[p.submission,{status:'Loading' as const}])):{}});
  const worker=async()=>{
   while(!cancelled&&index<rows.length) {
    const item=rows[index++];let detail:Detail<T>;
    try {
     const data=await load(item.submission);
     // A newer online revision must not be presented beside old metadata.
     if(data.submission!==item.submission||data.revision!==item.revision)throw Error('Availability changed');
     detail={status:'Ready',data};
    }catch{detail={status:'Unavailable'};}
    if(!cancelled)setState(old=>old.key===key?{key,rows:{...old.rows,[item.submission]:detail}}:old);
   }
  };
  if(authorized)for(let n=0;n<Math.min(3,rows.length);n++)void worker();
  return()=>{cancelled=true;};
 },[key,authorized,load]);
 return {rows:authorized&&state.key===key?state.rows:{},retry:()=>setAttempt(n=>n+1)};
}
