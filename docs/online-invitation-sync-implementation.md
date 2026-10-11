# Manual online invitation synchronization

Implementation of [specification #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1) and approved tickets [#2–#8](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/2). The production source and its database still require verification before rollout. This work does not deploy the online application or migrate the installed business database.

## Delivered behavior

One Local Master owns the receiver identity, pairing, pending metadata and import receipts; LAN clients share it. Authorized Admin and legacy IT Admin users pair through the existing Settings → Backup & Data Management page. Cloud Admin credentials are transient; a scoped, source-bound credential is encrypted in backend storage.

The Local Master checks availability using outbound HTTPS while an authorized Admin socket is active. Checks start on connection and repeat approximately every 30 seconds, with bounded backoff and jitter on failure. Opening the bell or event invitation panel requests the same shared check. Existing Socket.IO distributes updates to local clients. No inbound public access to localhost, SSE service, external broker or new dependency is required.

Notifications group by event and open its existing invitation modal. Pending rows contain metadata only. An explicit preview retrieves personal data transiently; session expiry clears it. An explicit Pull or Pull Selected is the only path that imports an online response. Missing verified event, invitation or member counterparts block the operation; names and integer IDs do not establish identity.

Each Pull fetches the current revision and commits its response, planned member registration, receipt and pending confirmation in one local transaction. Arrival statuses are preserved; guests do not become members. A previously untracked member RSVP can be adopted during deliberate Pull only when stable event/member identities establish the same unique RSVP and it has no conflicting receipt history. Repeated clicks and concurrent requests converge under the shared database lock. Batch items commit independently and report separate outcomes.

Only a committed receipt can authorize an exact-revision confirmation. Confirmation failures display “Imported locally · Confirmation pending”; background recovery retries confirmation without fetching/importing a newer response. Later answers become pending again. Source retention prevents deletion and truncation of responses awaiting confirmation, including cascading parent deletion.

Broad Cloud Sync excludes response imports in both directions and protects invitation-controlled planned registration fields, while allowing actual arrivals and unrelated supported transfers. Stable parent identities survive publication; conflicting invitation identities fail explicitly.

Full backups include receiver/source identity and import receipts without the encrypted credential. Restore validates receipt/business consistency and rebuilds availability from the source; online confirmations do not hide revisions missing locally. Replacing an incompatible receiver requires explicit recovery instead of silently creating another Local Master. An online-source restore is blocked in this local restore flow and needs its separate provider recovery procedure.

## Rollout prerequisites

1. Verify the actual public frontend, online Express API and authoritative PostgreSQL database. The repository's default API is Render, but the public Vercel host, hosting plan and deployed database correspondence were not confirmed by this local implementation. Do not guess from development environment files.
2. Back up both databases. Deploy the additive migration `023_invitation_sync.sql` through the normal schema initialization on both environments. Readiness checks require its tables and retention/revision triggers. Configure `INVITATION_SYNC_ROLE=source` on the online backend before accepting online submissions; source retention must be enabled before the first pairing.
3. Set `INVITATION_SYNC_ENCRYPTION_KEY` on the Local Master backend to a securely generated 32-byte key encoded as 64 hexadecimal characters. Keep it outside renderer builds and backups, and preserve it separately for disaster recovery. Changing it invalidates the stored encrypted pairing credential and requires reauthorization.
4. Set backend `INVITATION_SYNC_ALLOWED_ORIGINS` to the exact verified HTTPS API origin(s), comma separated. The default allows only `https://dpc-managementsystem.onrender.com`. Redirects, arbitrary URLs and embedded URL credentials are rejected. The test-only localhost exception is unavailable in normal runtime.
5. Establish verified parent provenance before first production Pull. Independently migrated legacy copies receive different UUIDs; matching numeric IDs or names is insufficient. Reconcile their stable identities only after explicit verification and backup. The feature intentionally does not infer or create missing parent records.
6. In Settings, inspect the source with cloud Admin authorization, verify the displayed source identity, then confirm pairing. Only one receiver is permitted. All LAN clients must point to the same Local Master API/database. Verify a controlled submission, preview, manual Pull, confirmation outage and reconnect before opening public usage.

No secrets were added to source control. No production deployment, live schema migration or real submission import was performed during development.

## Verify event in Settings

Added October 12, 2026 for [ticket #9](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/9). Settings → Backup & Data Management groups unmatched submissions by online event and provides **Verify event**. Create a full backup first. Review the authenticated online event title, dates and location, choose an existing local event, compare its details and explicitly confirm they are the same event. No local event is chosen automatically.

Verification changes the selected event's stable identity in a local transaction. Existing invitation links can also be verified when their token fingerprints match exactly and their personal member identities already match. Titles and numeric IDs are never used as automatic evidence. The audit entry records previous/new event and changed link identities. Source data, responses, registrations, receipts and remote confirmations are untouched. Stale review data, duplicate identities and reassigning imported history are rejected; errors roll back the complete change.

After verification, open the existing event invitation panel and preview/Pull deliberately. An unmatched invitation link or member remains blocked and requires its own verified recovery; Verify event does not create these records. Both local and online backends must be updated for the authenticated event-details endpoint. No extra schema migration is required beyond 023. The follow-up was checked with real isolated source/local HTTP/PostgreSQL, authorization/stale/conflict/rollback assertions and 10 browser checks covering verification, existing manual Pull and backup UI.

The follow-up Standards review identified stale local comparison details; confirmation now checks the locked local title/date/location fingerprint as well as the online fingerprint. Regression checks reject intervening online and local edits. Specification review reported no material findings. The final feature HTTP/database checks and three feature browser journeys passed after this fix; the seven backup regression checks passed in the preceding combined run. No live identity repair or production deployment was performed.

## Validation and review

The authenticated HTTP integration journey uses distinct disposable PostgreSQL source/local schemas. It checks metadata-only discovery, transient preview, manual guest/member imports, numeric-ID divergence, rollback, duplicate/concurrent clicks, failed confirmation and ACK-only recovery, newer revisions, retention guards, partial batch outcomes, full export/restore, scoped revocation and broad transfer boundaries. The final focused backend run passed 19 tests with no skips. A separate disposable-database runner (`npm --prefix server run test:isolated`) makes the full backend suite safe to run without targeting the business database.

The full backend suite was executed. Failures in legacy attendance date/API/phase-two checks, core seed expectations and the family backup fixture were reproduced at baseline commit `308690637726d8d72481c696172c26a1e8e5689e` under the same isolated setup. The full suite is therefore not green; those existing failures were not silently changed by this feature. Windows forced-exit behavior also affects the legacy attendance runner. Existing PostgreSQL concurrent-query deprecation and Vite chunk-size warnings remain.

Playwright covers Admin bell → event modal → preview → selected Pull, per-item feedback, offline state and session-expiry clearing in light desktop and dark mobile layouts. The final two feature journeys and seven backup regression checks passed. Existing public invitation, member search and study UI regression journeys also passed. These browser checks use API fixtures; database guarantees come from the real HTTP/PostgreSQL checks. TypeScript and production builds passed. Hosted end-to-end verification remains a rollout prerequisite.

### Standards review

Reviewed against the repository instructions and approved test seams. Fixed a missing selected invitation UUID that prevented conflict detection. Added a real transfer regression demonstrating that a matching bearer token cannot overwrite a different stable invitation identity.

### Specification review

Fixed registration field protection to retain actual arrival transfers, cleared sensitive preview state on expired sessions, restricted notification delivery to currently authorized sockets, reconciled availability when opening the bell/panel, and broadcast background connection failures so open panels update promptly. No remaining material transaction, receipt, confirmation or broad-transfer finding was reported after these fixes.
