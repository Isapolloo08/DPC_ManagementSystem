# Draft 2: Retain online submission revisions and protect invitation Cloud Sync

Publication status: approved and published as [GitHub issue #3](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/3). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

A recipient submits or changes an invitation response online and it remains safely available for later manual Pull. Organizers can keep publishing invitations and using other Cloud Sync transfers without stale Push replacing online-owned answers or broad Pull importing them into the Local Master.

## Acceptance criteria

- [ ] Preserve public general/personal links, member/guest validation, ministry scope, deadlines, deactivation, rate limits and transactional RSVP behavior. Atomically record stable submission identity and a distinguishable revision for every accepted current answer; rejected writes produce no pending revision.

- [ ] Backfill preexisting source responses safely through additive repeatable migrations without inventing parent correspondence. Repeated member answers across links honor existing logical response uniqueness; separate guest records are not merged by name/contact. Keep only the required current answer rather than introducing full edit history.

- [ ] Keep accepted responses retrievable after deadline, event start or deactivation and across offline periods, with no automatic pending expiry. Block destructive event/link and other cascading deletions that would erase unimported submissions; show organizers a useful explanation while preserving safe closure/deactivation.

- [ ] Protect invitation-owned responses and planned-registration fields in actual broad Push/Pull paths: no automatic import through broad Pull, stale online answer overwrite through Push or copying receiver-local credentials/receipts/confirmation history. Unknown ownership/provenance fails the conflicting transfer safely.

- [ ] Preserve supported parent/link publication, other Cloud Sync tables and actual attendance. Do not blanket-drop registration transfers; distinguish protected invitation-controlled fields from other supported registration behavior. Keep synchronization status/error feedback useful in the existing Cloud Sync UI.

- [ ] Verify online submit/change/closure/deletion and real broad transfer persisted outcomes in isolated PostgreSQL, including rollback, legacy divergence and stale transfers. Exercise existing public invitation and Cloud Sync browser journeys, permissions and relevant regressions. No production submissions or deployment.

## Blocked by

- GitHub issue #2: Pair the Local Master with a verified online source.

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
