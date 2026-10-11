export interface PendingSubmission {
  submission:string; revision:string; event_identity:string; event_title:string; event_id:number|null; updated_at:string;
  status:'Pending'|'Synchronized'|'Imported locally · Confirmation pending';
}
export interface InvitationSyncState {
  state:string; source_url:string|null; source_id:string|null; receiver:string; last_check:string|null; pending:PendingSubmission[];
}
export interface SubmissionPreview {
  submission:string; revision:string; name:string; contact:string; answer:'yes'|'no'|'maybe'; reason:string; blocked:string|null;
}
export interface PullOutcome {submission:string;revision?:string;status:string;error?:string;already_imported?:boolean}
export interface VerificationEvent {sync_identity:string;title:string;start_time:string;end_time:string;location:string|null;id?:number;fingerprint?:string}
export interface EventVerification {source:string;event:VerificationEvent;fingerprint:string;events:VerificationEvent[]}
export function checkedSyncState(value:InvitationSyncState):InvitationSyncState {
  if(!value||typeof value.state!=='string'||!Array.isArray(value.pending))throw new Error('Online invitation synchronization is unavailable in this backend version.');
  return value;
}
