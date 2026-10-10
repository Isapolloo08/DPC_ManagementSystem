export type InvitationAnswer = 'yes' | 'no' | 'maybe';
export interface InvitationLink {
  id: number; token: string; member_id: number | null; member_name?: string;
  enabled: boolean; accepting: boolean; deadline: string;
}
export interface InvitationResponse {
  id: number; name: string; contact: string; member_id: number | null;
  answer: InvitationAnswer; reason: string; updated_at: string;
}
export interface InvitationOverview {
  links: InvitationLink[]; responses: InvitationResponse[];
  counts: { yes: number; no: number; maybe: number; pending: number }; limit: number;
}
export interface PublicInvitation {
  title: string; description: string | null; start_time: string; end_time: string;
  location: string | null; deadline: string; personal: boolean; member_name: string; accepting: boolean; ministry_name?: string;
}
export interface InvitationMember { id: number; name: string }

// Public guests use the hosted API, independent of a staff account's LAN setting.
async function publicRequest<T>(path: string, body?: unknown): Promise<T> {
  const configured = import.meta.env.VITE_PUBLIC_API_URL || import.meta.env.VITE_API_URL;
  const base = configured ? configured.replace(/\/+$/, '').replace(/\/api$/, '') + '/api' : '/api';
  const response = await fetch(`${base}/event-invitations/public/${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), referrerPolicy: 'no-referrer', credentials: 'omit',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to process this invitation.');
  return result;
}
export const publicInvitations = {
  get: (token: string) => publicRequest<PublicInvitation>(token),
  members: (token: string, search: string) => publicRequest<{ members: InvitationMember[] }>(`${token}/members?search=${encodeURIComponent(search)}`),
  respond: (token: string, payload: { name: string; contact: string; answer: InvitationAnswer; reason: string; responseKey: string; attendeeType?: 'member' | 'guest'; member_id?: number }) =>
    publicRequest<{ message: string; responseKey?: string }>(token, payload),
};

export function invitationUrl(base: string, token: string) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter an http:// or https:// website URL.');
  url.hash = ''; url.search = '';
  return url.href.replace(/\/?$/, '/') + '#/invite/' + token;
}
