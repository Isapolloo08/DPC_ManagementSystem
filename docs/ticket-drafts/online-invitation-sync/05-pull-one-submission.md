# Draft 5: Manually Pull one submission with durable confirmation recovery

Publication status: approved and published as [GitHub issue #6](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/6). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

An Admin clicks Pull for one pending submission. The latest fetched online revision is saved locally exactly once with the correct planned registration and receipt, then confirmed online. If confirmation fails, the UI says Imported locally / Confirmation pending and recovery retries confirmation without importing again.

## Acceptance criteria

- [ ] Require a current local Admin action and scoped source/receiver authorization; re-fetch the latest available revision and independently validate the full payload, schema and verified parent mapping. Report the committed revision; blocked items remain pending with reasons and no parent creation.

- [ ] Atomically commit the response, applicable planned member registration, necessary verified mapping and durable per-revision import receipt/pending-confirmation record in one local transaction. Any pre-commit failure rolls back all item writes. Do not hold the transaction across online confirmation.

- [ ] Apply member answers to planned registration as Attending -> registered, Cannot attend -> cancelled, Not yet sure -> pending; preserve attended/checked_in and actual attendance. Guest Pull creates only a guest response and receipt, without membership, member registration or account creation.

- [ ] Enforce durable idempotency/concurrency for source/receiver/revision and the logical response, including repeated member links. Repeat clicks, overlapping LAN Admins, unknown commit outcomes and delayed older fetches cannot duplicate or downgrade business data. Reconcile committed state after lost replies before retry.

- [ ] Confirm only the exact locally committed revision for this receiver, idempotently after commit. Newer source revisions remain pending and newer imported revisions cannot be hidden by older acknowledgements. Show synchronized only after successful confirmation.

- [ ] Persist and retry receipt-based confirmation with bounded backoff after failures/restart/unknown acknowledgement outcome, including without an active Admin session where authorized by the pairing. Recovery never imports/fetches newer payloads; revoked pairing reports Reconnect required. Stop new import work when local authority expires.

- [ ] Update item status, bell/event pending counts and acting-user audit outcomes with per-item busy/success/blocked/failure/already-imported/confirmation-pending feedback. No sensitive full payloads or secrets in logs. Preview/read/discovery never triggers Pull.

- [ ] Use actual isolated PostgreSQL across HTTP boundaries for rollback fault injection, repeat/concurrent requests, source races, unknown commits, exact acknowledgement and restart recovery. Playwright proves the explicit click boundary and confirmation-pending/retry statuses. Include relevant invitation, Cloud Sync and affected backup regressions and typecheck/build checks.

## Blocked by

- GitHub issue #5: Preview a pending submission and explain blocked parent mappings.

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
