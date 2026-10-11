# Online-to-local invitation submission investigation

Interview status: complete. Q1-Q17 and final shared understanding confirmed by the user on October 11, 2026, Asia/Manila. This document records architecture evidence, confirmed requirements, recommendations, and external verification gaps for `grill-with-docs`. It is not an implementation specification or a ticket breakdown.

## Confirmed requirements

- Public invitation submissions must remain safely stored online while the local system is offline.
- The running local application detects availability while connected, including after reconnection, and displays in-app notifications.
- No automatic import of submission business records is permitted. Authorized users explicitly Pull them.
- The administrator can view pending submissions or metadata before choosing to Pull.
- Validate data and parent relationships; avoid duplicate imports under retries and repeated clicks.
- Mark synchronized only after the local transaction succeeds.
- Handle interrupted transfers, connection failures, server errors, and notification/status updates.
- Preserve invitation behavior and database integrity; reuse authentication, notification, API, and design patterns.
- Localhost does not need to be exposed publicly.
- Only the interview and documentation workflow is authorized. No application implementation, migrations, deployment, new issues, tickets, or code-review workflow is authorized now.

The manual-import boundary is recorded in [ADR-0001](./adr/0001-manual-online-invitation-import.md). The user accepted Q1-Q5, Q6-Q11, Q12-Q17 and the final agreed-flow summary on October 11, 2026. The interview's product decision frontier is empty and shared understanding is confirmed. Unverified deployment facts and technical validation tasks below are not silently treated as resolved.

### Confirmed in interview round 1

- Scope is the existing event invitation RSVP workflow for members/guests and yes/no/maybe answers, preserving separate actual attendance.
- One authoritative local Master database receives submissions. LAN clients share that database and its synchronization state; separate receiving databases are outside the initial scope.
- Only Admin receives this feature's pending-online notifications, previews and Pull permissions in the first version, matching existing Cloud Sync role handling. Existing invitation management permissions remain as they are.
- Approximately 30-second availability polling while an authorized session is active, with startup/reconnection checks, is acceptable. Planned high-volume operation was not stated; server backoff and stale states still apply.
- The existing bell opens the relevant event invitation modal with a pending-online section, on-demand remote preview, and an explicit Pull action. Reading a notification or preview does not import business records.

### Confirmed in interview round 2

- Changed online answers become pending again. Pull imports the latest available answer rather than introducing a complete answer-history feature. A version newer than the exact imported version remains pending.
- Online invitation answers are authoritative. Pull updates the matched local response and planned member registration, preserves actual attendance and attended/checked_in status, and does not create members/accounts for guests. Unexpected identity conflicts are blocked for review.
- Support individual Pull and Pull Selected within the event. Each response and its receipt use an atomic local transaction; batches report per-item outcomes and retain failed items as pending without reverting other successful items.
- Missing or unverified local event/member/link counterparts block the item. No automatic creation/import of parent business records and no identity inference from equal numeric IDs.
- Existing broad Cloud Sync remains available for other records and invitation publication, but must protect newer online-owned responses and invitation-controlled registration fields. General Pull must not bypass dedicated invitation Pull approval. Exact transfer exclusions/merge rules still require design validation.
- One-time pairing through an authorized cloud Admin issues a narrowly scoped revocable integration credential, kept by the local backend. Normal local Admin sessions then check/preview/Pull without a separate cloud sign-in every three days. Verify the online backend/database source before pairing; no cloud password or database connection string is placed in the renderer.

### Confirmed in interview round 3

- Automatic discovery persists minimal availability metadata only; sensitive response fields are transient, on-demand authorized previews until explicit Pull. Previews clear on logout.
- Group alerts by event, distinguish unread and pending counts, reconcile on panel opening, preserve stale last-known status offline, and avoid repetitive offline/retry toasts. Reading/dismissing does not remove pending submissions.
- Previously accepted responses remain pullable after closure/deactivation. Pending submissions have no automatic expiry; block destructive deletion that would remove unimported responses. No new Reject/Archive flow in the initial version.
- Local commit followed by failed acknowledgement displays Imported locally / Confirmation pending. Retry acknowledgement automatically after failure/restart; never re-import the response or automatically import a new revision.
- Backup/restore includes receiver identity, mappings and receipts. Reconcile current online revisions against restored local receipts independently of older online acknowledgements; missing local versions require explicit Pull. Ambiguous/lost mappings block import.
- Master discovery runs while the app and an authorized session are active, including minimized/tray use. Logout/expired authorization pauses discovery/Pull; revoked pairing requires reconnect. Startup must wait for schema and identity readiness. No discovery runs with the app/backend closed. Receipt-based acknowledgement retries may run without payload discovery/import.

## Current architecture and data flow

The desktop application uses Electron, a React/Vite client, Express, PostgreSQL, and Socket.IO. `server/src/db/schema.ts` uses a PostgreSQL pool and transaction wrapper. Historical SQLite files exist in `server/data/`, but the inspected active backend code and running local database use PostgreSQL.

The invitation deployment guide describes a dedicated public Vite frontend on Vercel, the existing Render API at `https://dpc-managementsystem.onrender.com`, and a Supabase database. `client/vercel.json` builds the invitation-only entry; `client/vite.invitations.config.ts` requires a public HTTPS API URL at build time. No actual Vercel production hostname was established in this investigation.

Existing event RSVP flow:

1. An organizer generates a general or personal link through `server/src/routes/eventInvitations.ts`. Access requires Admin, Pastor, or an appropriately scoped Coordinator.
2. The link resolves to `/#/invite/<token>`. The website URL preference only changes the generated frontend URL; it does not publish events or links to a different database.
3. `client/src/services/eventInvitations.ts` sends anonymous invitation GET/POST requests to `VITE_PUBLIC_API_URL` independently of staff API/LAN configuration. The public request carries neither staff account credentials nor cookies.
4. The online backend validates the token, deadline, attendee type, name/contact and response. It locks the invitation link and writes the response in a transaction.
5. A member response also updates planned `event_registrations`: yes -> registered, no -> cancelled, maybe -> pending. Existing attended/checked_in statuses are preserved. Guest responses do not create members or member registrations in the current workflow. No actual attendance is inserted.
6. The backend emits `events:changed` after the transaction completes. Only clients connected to that backend receive this event.
7. The organizer's invitation modal reads the database of the selected staff backend. When the desktop uses the local backend, online responses require an explicit transfer to become local records.

Public identity limitations are already documented: general member selection is self-declared; possessing a personal link permits responding for that member; guest duplicate prevention uses a browser receipt, not verified personal identity. Switching browsers may produce multiple legitimate source records. Import idempotency must distinguish this from importing the same source record twice.

## Database structure and actual read-only checks

Inspected migrations 001, 007, 012, 015, 020, 021 and 022 and the source schema initialization mechanism. Relevant tables:

| Table | Relevant integrity/meaning |
| --- | --- |
| `event_invitation_links` | Unique bearer token; event/member foreign keys; one personal link per event/member |
| `event_invitation_responses` | Invitation/event/member foreign keys; unique invitation/response receipt; one member response per event; answer/reason constraints; updated_at |
| `event_registrations` | Unique event/member planned RSVP |
| `events`, `members`, ministry association tables | Parents and scope that must already correspond across environments |
| `notifications` | Per-user alert and read status; not an import ledger |
| `notification_log` | Unique event key/channel/recipient delivery deduplication |
| `system_settings` | Existing server-specific cloud connection and broad synchronization history |

Database metadata/count reads were performed using standalone clients inside read-only transactions with timeouts, followed by rollback. No schema module was imported and no database records were changed. Counts are point-in-time observations, not proof of row-by-row correspondence:

| Database | Invitation links | Responses | Event registrations | Events | Members |
| --- | ---: | ---: | ---: | ---: | ---: |
| Installed application's configured local PostgreSQL | 3 | 1 | 0 | 8 | 81 |
| Cloud database configured in local Cloud Sync settings | 3 | 2 | 1 | 8 | 84 |

Both actual schemas contain the invitation columns and uniqueness constraints above. Neither contains submission revision, per-submission import receipt, or acknowledgement fields. The differing response counts show divergence; they do not identify the missing response or detect an edited existing response.

## Runtime and deployment findings

- The current localhost port 4000 listener belongs to the installed DPC Management System application. Its packaged environment targets localhost PostgreSQL; its server mode is Master. Local GET health returned 200 and database connected.
- The source root environment instead names a Supabase pooler in ap-southeast-1. The source server environment targets local PostgreSQL. Inherited environment and startup cwd affect selection; a localhost HTTP address alone does not establish a local database.
- The installed local Cloud Sync setting targets a different Supabase pooler in ap-south-1 and is reachable. The source root cloud connection was unavailable during read-only checks.
- It is not proven that the configured Cloud Sync database is the database used by Render. This must be verified from trusted deployment configuration or explicit backend identity before pairing the feature. No credentials are recorded here.
- Current live Render read-only probes: GET `/api/health` -> 200 JSON, database connected; GET `/api/event-invitations/public/not-a-token` -> 404 JSON, Invitation not found; GET `/api/event-invitations/events/1` without authentication -> 401 JSON. The router is now deployed, superseding the October 10 router-absent observation in the deployment guide.
- These probes do not prove a real invitation works, full production schema health, service plan, staff cloud authentication, or which database the service uses. No live submission was performed.
- Electron Master mode starts the local backend; remote/LAN Client mode uses another backend and stops the embedded one. Put eventual discovery on the backend owning the receiving database to avoid a poller per browser.

## Existing synchronization: reusable protections and limitations

`server/src/routes/cloudSync.ts` restricts cloud transfers to Admin (with existing IT Admin compatibility). `server/src/db/cloudSyncService.ts` connects directly to remote PostgreSQL and transfers 30 tables. It is not an HTTP invitation synchronization API.

The transfer includes links, responses and registrations, along with unrelated users, settings, members, attendance and audit records. Status compares counts of seven broad tables, omitting invitations; it runs when the cloud modal opens rather than periodically discovering pending responses.

Useful existing protections include a destination transaction/advisory lock, repeatable-read source snapshot, schema prechecks, timeouts/cancellation, selected natural-key ID remapping, and atomic synchronization history/audit. Existing PostgreSQL tests cover retry, schema drift, collision, cancellation and rollback.

Limitations affecting this proposal:

- General Pull imports all configured tables and overwrites matching fields. It does not identify pending invitation revisions or selectively validate invitation business rules.
- Members/events still rely on numeric ID correspondence. Independent cloud/local creation can collide; equal integers do not prove the same person/event. Parent identity must be verified or mapped durably.
- Invitation link token matching helps identify links, but bearer tokens must not become public notification identifiers or leak through logs.
- Response matching by invitation/receipt is insufficient alone for edited member answers across links; the per-event member uniqueness must also be respected.
- No source version receipt or per-installation acknowledgement exists. A count or global last-sync timestamp cannot establish that a particular response version was imported.
- A later broad Push may overwrite a newer online response with stale local values; broad Pull may import submissions outside the new inbox. Compatibility policy must be chosen before implementation.

Do not wire the new invitation Pull button to the current general Pull operation. Reuse safe transaction/auth/UI patterns while defining a bounded invitation transfer. This boundary and protection of online-owned answers were accepted in Q10. Exact affected transfer columns and identity associations are implementation validation work; the behavior must fail safely rather than bypass the approved boundary.

## Discovery architecture: confirmed direction, remaining details

Use one periodic outbound HTTPS metadata poller on the receiving local Master backend, calling a narrow authenticated API on the existing Render service. The user accepted approximately 30-second checks while an authorized session is active, startup/reconnection checks after readiness, one-time pairing and minimized/tray behavior. Reliability details are bounded timeouts, no overlapping requests, jitter/backoff for failures and respect for rate limiting. Future operating volume is unstated; approximately 30 seconds is a healthy-state check interval, not a guaranteed delivery SLA during service sleep/outages.

| Option | Assessment |
| --- | --- |
| Periodic HTTPS polling | Simplest durable catch-up path with existing Express/API patterns. Fetch only availability identifiers/revisions and minimal authorized metadata automatically. |
| SSE | No existing SSE route was found. A streaming route adds auth, heartbeat, timeout/compression and reconnect work while still needing catch-up reads. |
| Existing Socket.IO across cloud/local | Render supports WebSockets and the project already uses them, but current sockets connect to one backend only. A new outbound cloud connection needs separate cloud auth and persisted recovery; local sockets alone cannot see remote writes. Consider only if confirmed latency warrants it. |
| Existing broad cloud-sync operations | Useful implementation patterns, but their scope and overwrite rules do not meet pending-submission discovery or selective import requirements. |

Use existing local Socket.IO user rooms to deliver discovered alerts/status to authorized local/LAN clients. Online event broadcasts are hints, not durable records; reconciliation must work after missed events. Polling does not require exposing localhost, a second backend, Redis, or a message broker.

Render supports public WebSockets but connections can end on deploy/network failure and require reconnection: [Render WebSockets](https://render.com/docs/websocket). If the service is Free, idle spin-down and approximately one-minute startup can affect detection and form loading; that plan is unverified: [Render Free services](https://render.com/docs/free). Socket.IO documents that connection recovery is not guaranteed, reinforcing the need for a persistent catch-up read: [Socket.IO connection recovery](https://socket.io/docs/v4/connection-state-recovery/).

## Confirmed manual transfer direction and proposed recovery details

On explicit Pull, the local backend checks current Admin authorization, fetches the selected source response/version from the authenticated online API, validates fields and verified parent identity, and performs the business writes and durable import receipt in one local transaction per response. Individual Pull and Pull Selected are approved. A batch reports individual results and leaves failures pending; repeated clicks/retries use the same source identity/version and cannot create repeated business records. Changed online answers become pending again; online answers control RSVP state while actual attendance and attended/checked_in registrations are preserved.

After local commit, acknowledge exactly the imported version to the online service. There is no atomic transaction spanning local and cloud databases. If acknowledgement fails after commit, preserve a durable pending acknowledgement and display locally imported / acknowledgement pending. Retrying that acknowledgement must not re-import the response. Automatic metadata checks and acknowledgement retries do not authorize automatic import of a newer answer. A newer online answer remains pending until an explicit Pull.

Agreed states: pending, pulling, locally imported/confirmation pending, synchronized, and failed/blocked. Pending and connection state are separate: offline is not zero pending. Retain the last successful check time and show stale availability clearly. Backup/restore reconciles retained current online revisions against actual local receipts, even if they had been acknowledged before restore; absence of a receipt never authorizes automatic business import.

Technical guardrails implied by the accepted behavior: source responses need stable source identity and distinguishable revisions; acknowledgements must identify the receiver and exact committed revision rather than set a global boolean. A later source revision cannot be cleared by acknowledging an older one. Local writes, identity mappings and receipt claims must be transactionally consistent and protected by database uniqueness/locking, including overlapping clicks and unknown outcomes after disconnect. Previewing a revision does not reserve it; Pull uses the latest fetched revision and reports which revision actually committed.

The online source remains responsible for responses; notification cleanup does not delete them. Restore recovery applies to responses still retained online. If already synchronized remote records were deliberately deleted later, they cannot be recreated from acknowledgements alone; recovery then depends on a valid backup. Unverifiable parents, deleted source records or schema incompatibility are reported as blockers rather than guessed or silently skipped.

## Authentication and security findings

- Existing HTTP auth verifies a backend-specific JWT and looks up the user/role/ministries in that backend's database. A local token/user ID must not automatically be treated as an authorized cloud identity. One-time cloud Admin pairing and a scoped revocable integration credential were accepted; credential storage must remain server-side and pairing requires verified source identity.
- Existing invitation management permissions (Admin/Pastor/scoped Coordinator) differ from existing cloud-transfer permissions (Admin). Q3 selects Admin-only feature visibility/Pull; enforce it server-side without broadening existing permissions.
- Keep metadata, previews, downloads and acknowledgements authenticated and event/installation scoped. Avoid contact/reason data in global broadcasts; reuse authorized user rooms.
- CORS is permissive in the current backend; CORS is not authentication. The public invitation bearer token is not a staff sync credential.
- Existing cloud connection strings must remain outside frontend builds and notifications. Remote DB TLS verification is currently disabled in relevant database client configuration; verify transport/certificate configuration when defining the secure HTTP integration.
- Source auth code retains an original password in `temp_password` during registration/login. Do not use or replicate this behavior to bridge cloud credentials. No auth refactor is authorized in this workflow.
- Preserve rate limiting and bounded responses. Public form validation and browser-receipt deduplication do not establish guest identity.
- Link/event deletion cascades can remove responses before a delayed local Pull. Q14 requires pending retention and blocking destructive deletion of unimported responses; ordinary closing/deactivation does not prevent retrieval of previously accepted responses.

## UI direction: confirmed location, remaining details

Reuse the existing notification bell, user notifications, toast messages, ModalShell, Button, Badge and invitation response panel. The current bell is visible to Admin/Pastor (including legacy IT Admin), while invitation management also permits scoped Coordinators.

The user approved the existing bell opening the relevant event invitation modal, a pending-online section, on-demand remote preview and individual/selected Pull actions. A proposed compact alert is 'New online invitation responses are waiting'. Existing event navigation does not currently pass a notification event reference into the invitation modal, so exact deep-link behavior needs a small integration later. Sensitive fields are fetched into transient preview on demand; business persistence occurs only at Pull.

Keep unread-alert count separate from pending-import count. Opening/marking all notifications read must leave pending responses accessible. Notifications are cleaned up after 90 days; pending import state must outlive notification deletion. Deduplicate alerts by source revision/recipient; group bursts and avoid a new toast on every poll.

Use the established navy/gold palette, semantic status tokens and light/dark invitation styling. Show checking/offline/retrying, last successful check, per-item failure, busy Pull, successful import and confirmation pending in the panel. Avoid an extra dashboard widget. Cached availability is metadata, not an imported RSVP; online previews are fetched on demand and cleared on logout.

## Interview record: round 1 complete

Q1-Q5 accepted by the user: existing event RSVP scope, one local Master database, Admin-only feature access, approximately 30-second discovery and startup/reconnect checks, and existing bell/event invitation modal with remote preview and explicit Pull.

## Interview record: round 2 complete

The user accepted Q6-Q11. The following entries retain the questions' meaning as the decision record:

6. **Updated answers:** An updated online RSVP becomes pending again. Pull imports the latest available answer, not a full change history. An answer changed during transfer remains pending if it is newer than the exact imported revision.
7. **Response authority:** The online response is authoritative for invitation answers; a Pull updates the matching local response and its planned member registration. Preserve attended/checked_in status and actual attendance; guest responses do not create members or staff accounts. Any unexpected identity or registration conflict is blocked for review rather than guessing.
8. **Pull controls and failures:** Support individual Pull and Pull Selected within the event. A batch has an atomic transaction per response, reports success/failure individually and leaves failed items pending; it does not revert successful unrelated items.
9. **Missing parents:** If an event, member or invitation has no verified local counterpart, block that item with a useful explanation. Do not automatically create/import unrelated members/events or trust matching numeric IDs. Dependency repair remains explicit.
10. **Broad Cloud Sync compatibility:** Retain broad Cloud Sync for its other records and invitation publication, but prevent it from overwriting newer online-owned answers or importing pending answers around the dedicated Pull. Protect invitation-controlled registration fields consistently, while preserving attendance. The exact exclusion/merge boundaries need later design validation.
11. **Cloud pairing experience:** Configure the online source once using an authorized cloud administrator to pair a narrowly scoped revocable integration credential, retained only by the local backend. Subsequent local Admin sessions can check/preview/Pull without repeated cloud login. Verify the Render database identity; no cloud account password or DB connection string is placed in the renderer.

## Interview record: round 3 complete

The user accepted Q12-Q17. The following entries retain the accepted decisions:

12. **Preview privacy:** Automatic discovery stores only minimal availability metadata (opaque source identity/version, event reference/title, counts, update time). Name, contact, answer and reason are fetched into an authorized transient preview on demand, not persisted as local business records before Pull.
13. **Notification behavior:** Group pending alerts by event; distinguish unread alerts from pending count. Read/dismiss does not clear pending; opening the bell/panel reconciles status; show last-known metadata as stale offline, avoid repeated offline/retry toasts, and alert again for genuinely new/updated submissions.
14. **Retention:** Responses accepted before closure stay eligible for later manual Pull even after deadline, event start or link deactivation. No automatic pending-submission expiry; block destructive deletion that would remove unimported responses, with an explicit future retention policy if needed. No new Reject/Archive workflow in the first version.
15. **Commit/acknowledgement recovery:** If local commit succeeds but cloud acknowledgement fails, show locally imported / confirmation pending and automatically retry only that acknowledgement, including after restart. Never automatically import a newer version during recovery.
16. **Backup/restore recovery:** Include receiver identity, mappings and import receipts in local backup/restore. After restoring older data, reconcile current online revisions against local receipts even if the cloud previously acknowledged them; show newly missing versions as pending for manual Pull. Lost/ambiguous identity mappings block import rather than infer from names or numeric IDs; remote acknowledgements alone cannot hide missing local records.
17. **Operational boundaries:** Discovery runs on the Master while the app and an authorized session are active, including minimized/tray use; logout/no valid Admin session pauses discovery and Pull. Existing previews close/clear on logout. Revoked cloud pairing shows reconnect required. Startup discovery begins only after schema/identity readiness; the feature is not active when the application/backend is closed. Durable receipt-based acknowledgement retries may run without fetching/importing response payloads.

## External verification gaps and technical checks before implementation

- Verify that the paired Render service owns the intended cloud data source; source root env, installed Cloud Sync settings and Render cannot be assumed interchangeable. A mismatch must block pairing/import rather than change an existing connection automatically.
- Validate exact revision acknowledgement under a newer concurrent response, overlapping Pulls, lost HTTP replies and restart; stable source/receiver identity and receipt-based restoration are required by the accepted decisions.
- Choose backend-only protected credential storage and validate revocation/expiry handling. Cloud pairing is independent of local JWT identity; neither plaintext cloud passwords nor broad database credentials enter the renderer.
- Verify provenance for existing event/member/link counterparts. Preexisting integer IDs are insufficient proof. No general migration, renumbering or manual-repair UI is authorized here; unresolved mappings block that response and identify the required explicit repair.
- Validate the exact broad Cloud Sync merge/exclusion boundaries for response data and invitation-controlled registration fields, including both Push and Pull. Existing invitation publication remains supported; unresolved safety concerns block conflicting transfer rather than bypass the new workflow.
- Review schema readiness, additive migration compatibility, backup/restore ordering and new receipt/identity state. Existing public form validation/deadlines remain intact; retrieval of accepted responses is separate from the public submission deadline.
- Service plan and actual Vercel hostname remain unverified external facts. The agreed design must handle service sleep/failure; no fast-detection SLA is promised. Expected future submission volume was not specified.

All seventeen interview decisions and the agreed flow below are accepted. The user confirmed final shared understanding, completing the interview. Unverified external deployment facts remain explicit prerequisites rather than questions that require the user to guess. Subsequent workflows require separate user approval; none has been started.

## Confirmed agreed flow

Public invitation submission -> durable online RSVP -> local Master outbound metadata check -> grouped Admin bell alert -> event modal and optional transient preview -> explicit individual/selected Pull -> verified parent mapping and local transaction (response, planned registration, receipt) -> exact-revision online acknowledgement -> synchronized status.

Failures before commit leave the response pending/blocked. Failure of online confirmation after local commit leaves it locally imported / confirmation pending and retries confirmation only. New online revisions, stale restored receipts, or missing local versions require another explicit Pull. Actual attendance remains untouched. The local database is shared by LAN clients and has one synchronization history; no public access to localhost is needed.

Initial scope excludes automatic response import, full response history, independent receiving installations, guest-to-member/account creation, new Reject/Archive controls, and new dashboard widgets. No specification, tickets, implementation, commit or deployment has been executed for this feature.

## Evidence locations

- `docs/event-invitations.md`, `docs/vercel-event-invitations.md`
- `client/vercel.json`, `client/vite.invitations.config.ts`, `client/src/invitation-main.tsx`
- `client/src/services/eventInvitations.ts`, `client/src/pages/EventInvitationPage.tsx`
- `server/src/routes/eventInvitations.ts:10,31,141`, migrations 020/021/022
- `server/src/db/schema.ts:8,35,131,896`, migration 001 event/member/registration relationships
- `server/src/db/cloudSyncService.ts:43,79,162,260`, `server/src/db/cloudSyncTransfer.ts:30,93,148`
- `server/src/routes/cloudSync.ts:16`, `client/src/components/cloud/CloudSyncModal.tsx:43,160`
- `server/src/middleware/auth.ts`, `server/src/routes/auth.ts`, `client/src/api.ts`, `client/src/context/AuthContext.tsx`
- `server/src/socket.ts`, `client/src/socket.ts`
- `server/src/services/notificationService.ts:104,137,176`, `server/src/routes/notifications.ts`
- `server/src/services/emailOutboxWorker.ts:109`, migration 007
- `client/src/components/notifications/NotificationBell.tsx`, `client/src/components/layout/Navbar.tsx:146`
- `client/src/App.tsx:101,163`, `client/src/pages/EventsPage.tsx:172,1884`
- `client/src/components/events/EventInvitationsModal.tsx`, its stylesheet, `client/src/design-tokens.css`
- `electron/serverManager.js:64`, `electron/configManager.js:41`, `electron/main.js:136`
- Existing invitation unit/PostgreSQL tests and `server/src/db/cloudSyncTransfer.test.ts`
