export interface VisitSyncItem {submission:string;revision:string;visit_date:string;updated_at:string;status:'Pending'|'Confirmation pending'|'Synchronized'}
export interface VisitSyncState {state:string;source_id:string|null;last_check:string|null;pending:VisitSyncItem[]}
export interface VisitPreview {submission:string;revision:string;visit_date:string;full_name:string;email:string|null;phone:string|null;party:string;questions:string;visitor_reply:string;bringing_children:boolean;child_age_groups:string[]}
export interface VisitPullResult {submission:string;status:string;error?:string}
