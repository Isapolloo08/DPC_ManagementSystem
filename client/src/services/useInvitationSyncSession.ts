import {useEffect,useState} from 'react';
import {isJwtExpired,useAuth} from '../context/AuthContext';

/** Privacy boundary also runs while the general expiration dialog is still open. */
export function useInvitationSyncSession() {
  const {token,user}=useAuth();
  const [expired,setExpired]=useState(()=>isJwtExpired(token));
  useEffect(()=>{
    setExpired(isJwtExpired(token));
    const expire=()=>setExpired(true);
    const check=()=>{if(isJwtExpired(token))expire();};
    window.addEventListener('auth:session-expired',expire);
    const timer=setInterval(check,1000);
    return()=>{clearInterval(timer);window.removeEventListener('auth:session-expired',expire);};
  },[token]);
  return !expired&&['Admin','IT Admin'].includes(user?.role_name||'');
}
