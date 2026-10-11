# Draft 3: Discover pending online submissions through the notification bell

Publication status: approved and published as [GitHub issue #4](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/4). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

While a valid local Admin session is active, the running Local Master discovers pending submission metadata and updates event-grouped alerts. The bell opens the correct event invitation modal with pending count and connection freshness, without importing any response.

## Acceptance criteria

- [ ] Expose authenticated, receiver/source-scoped bounded and paginated availability over outbound HTTPS. Return only opaque submission identity/revision, event reference/title, counts and update time/completeness; omit respondent names, contacts, answer, reason and invitation tokens.

- [ ] Use one non-overlapping Master scheduler at approximately 30 seconds in healthy conditions, with bounded requests, backoff/jitter and rate-limit handling. Check after startup/reconnect only once schema/pairing readiness is established; continue minimized/tray with valid Admin authority, stop new checks on logout/expiry/backend closure.

- [ ] Compare source revisions against actual durable local receipts, never counts/timestamps or remote acknowledgements alone. Allow first-use empty receipts; represent locally imported/confirmation-pending separately and expose newer revisions as pending. Share metadata and state among LAN clients.

- [ ] Reuse existing per-user notification persistence/deduplication and authenticated delivery restricted to Admin. Group by event, alert for genuinely new/changed work and avoid repeated unchanged-poll toasts. Read/dismiss/cleanup never removes pending state or acknowledges synchronization.

- [ ] Wire bell navigation to the correct event invitation modal and show pending versus unanswered invitations distinctly. Reconcile on authorized bell/panel opening; retain minimal cached metadata and last successful check with explicit offline/retrying/stale/Reconnect required states. Errors and incomplete pages cannot become zero pending.

- [ ] Verify HTTP/PostgreSQL no-business-write discovery, pagination, repeat polls, lifecycle/tray authorization, wrong receiver, source changes and network faults; use controlled clock/transport. Playwright covers bell navigation, Admin-only visibility, unread-versus-pending, offline/reconnect and responsive light/dark layout.

## Blocked by

- GitHub issue #3: Retain online submission revisions and protect invitation Cloud Sync.

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
