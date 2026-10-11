/** Restore durable receiver state after business rows, never credentials or automatic imports. */
export async function restoreInvitationSync(tx:{unsafe:Function},payload:Record<string,any[]>,mode:string) {
  const current=(await tx.unsafe('SELECT * FROM invitation_sync_node WHERE id=1'))[0];
  const backup=payload.invitation_sync_node?.[0];
  if(backup) {
    if(payload.invitation_sync_node.length!==1||backup.id!==1||backup.source_enabled) throw new Error('This backup is not a compatible Local Master synchronization backup.');
    if(mode==='merge' && (backup.identity!==current.identity||backup.source_id!==current.source_id)) throw new Error('Cannot merge another receiver or source synchronization history.');
    const same=current.identity===backup.identity&&current.source_id===backup.source_id&&current.source_url===backup.source_url;
    await tx.unsafe("UPDATE invitation_sync_node SET identity=$1,source_id=$2,source_url=$3,credential=$4,last_check=NULL,state=$5 WHERE id=1",[backup.identity,backup.source_id||null,backup.source_url||null,same?current.credential:null,same&&current.credential?'Offline · Retrying':'Reconnect required']);
  }
  if(mode==='replace') {
    await tx.unsafe('DELETE FROM invitation_sync_receipts');await tx.unsafe('DELETE FROM invitation_sync_pending');
  }
  const node=(await tx.unsafe('SELECT identity,source_id FROM invitation_sync_node WHERE id=1'))[0];
  for(const r of payload.invitation_sync_receipts||[]) {
    if(r.receiver!==node.identity||r.source!==node.source_id) throw new Error('Backup import receipt does not match the restored receiver/source.');
    const response=(await tx.unsafe('SELECT sync_identity,sync_revision::text AS revision FROM event_invitation_responses WHERE id=$1',[r.response_id]))[0];
    if(!response||response.sync_identity!==r.submission||BigInt(response.revision)<BigInt(r.revision)) throw new Error('Backup receipt lacks its corresponding imported response. Restore cannot claim success.');
    await tx.unsafe(`INSERT INTO invitation_sync_receipts(source,receiver,submission,revision,response_id,confirmed,created_at,attempts,next_attempt)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,now()) ON CONFLICT DO NOTHING`,[r.source,r.receiver,r.submission,r.revision,r.response_id,Boolean(r.confirmed),r.created_at]);
  }
  // Cached metadata is rebuilt from retained online revisions after authorized reconnection.
}

export async function restorePlannedVisitSync(tx:{unsafe:Function},payload:Record<string,any[]>) {
  const node=(await tx.unsafe('SELECT identity,source_id FROM invitation_sync_node WHERE id=1'))[0];
  for(const r of payload.visit_sync_receipts||[]) {
    if(r.source!==node.source_id||r.receiver!==node.identity)throw new Error('Visit receipt source or receiver does not match this restored Master.');
    const visit=(await tx.unsafe('SELECT id,sync_revision::text FROM planned_visits WHERE receipt_id=$1',[r.submission]))[0];
    if(!visit||BigInt(visit.sync_revision)<BigInt(r.revision))throw new Error('Restored visit receipt lacks its local visit revision.');
    await tx.unsafe(`INSERT INTO visit_sync_receipts(source,receiver,submission,revision,visit_id,payload_hash,confirmed) VALUES($1,$2,$3,$4,$5,$6,false) ON CONFLICT DO NOTHING`,[r.source,r.receiver,r.submission,r.revision,visit.id,r.payload_hash]);
  }
  await tx.unsafe("UPDATE visit_sync_state SET state='Not checked',last_check=NULL WHERE id=1");
}
