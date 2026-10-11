# Draft 7: Recover manual submission synchronization after backup and restore

Publication status: approved and published as [GitHub issue #8](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/8). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

A backup operator restores compatible Local Master data and the Admin sees the correct pending submissions again. Receiver identity, mappings, receipts and pending confirmations survive; retained online revisions missing locally require manual Pull even if already acknowledged online.

## Acceptance criteria

- [ ] Include receiver identity, verified mappings, import receipts and durable pending confirmations in compatible backup/restore with referentially correct ordering and existing permission checks. Protect integration credentials according to the backend-only pairing policy; require reconnect if they cannot be restored safely.

- [ ] Reconcile retained current source revisions against actual restored receipts/business state, regardless of earlier remote confirmations. A missing local revision becomes pending; an already imported revision awaiting acknowledgement remains confirmation-pending. Restore/discovery does no business import.

- [ ] Preserve receiver identity for compatible restores and block lost/ambiguous source or parent correspondence with actionable status. Never guess counterparts, duplicate guest records, silently create another receiver or migrate synchronization history through broad Cloud Sync.

- [ ] Restart durable confirmation-only recovery safely after restore and leave newer answers for another explicit Pull. Reconcile receipt/business inconsistency or unknown restore outcome conservatively rather than treating cloud acknowledgement as proof of local import.

- [ ] Integrate restored readiness/freshness/blocked states into the existing backup workflow and pending panel. Explain that deliberately deleted remote payloads require a valid backup; acknowledgement cannot reconstruct data. Keep pending retention/deletion protections and actual attendance intact.

- [ ] Test real isolated PostgreSQL backup/restore before/after import, older backup after remote confirmation, pending acknowledgement, missing mappings, legacy backup and incompatible schemas. Playwright covers restore status -> pending panel -> explicit re-Pull; run affected backup/invitation/cloud-transfer regressions and relevant build/typechecks.

## Blocked by

- GitHub issue #6: Manually Pull one submission with durable confirmation recovery.

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
