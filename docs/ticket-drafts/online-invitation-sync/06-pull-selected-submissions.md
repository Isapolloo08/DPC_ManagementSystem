# Draft 6: Pull Selected submissions with independent item outcomes

Publication status: approved and published as [GitHub issue #7](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/7). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

An Admin selects pending submissions within one event and deliberately starts Pull Selected. Each item follows the safe single-Pull path and retains its own outcome; failures or interruption do not undo successful items or automatically retry failed imports.

## Acceptance criteria

- [ ] Provide event-scoped selection and Pull Selected in the existing pending panel, with explicit action, bounded batch size/time, accessible selection/busy controls and per-item progress. Never implicitly select other events or silently import all pending responses.

- [ ] Enforce Admin/session, source/receiver and event scope server-side, not just in UI. Reuse single-item latest-revision validation, mapping, atomicity, concurrency and exact confirmation rather than introducing a bypass.

- [ ] Use one transaction per item and report committed/synchronized, confirmation-pending, already-imported, failed and blocked outcomes individually. One item failure preserves earlier successes; failed/unprocessed items remain available for another explicit Pull.

- [ ] Under cancellation, logout/expiry, request loss or server interruption, stop further import work, retain existing item commits and reconcile durable outcomes before reporting/retry. Durable committed confirmation-only retries remain safe; no automatic retry/import of failed or newer revisions.

- [ ] Update grouped notifications/pending counts and audit attribution consistently without repeated success/error noise or leaking previews. Show clear partial-completion and recoverable versus blocked failure messages using DPC light/dark and responsive patterns.

- [ ] Verify mixed real-PostgreSQL item outcomes, repeated/overlapping batches, limits, source changes, cancellation and unknown outcomes through HTTP. Playwright exercises selection, explicit submission, partial failure, logout and confirmation-pending feedback.

## Blocked by

- GitHub issue #6: Manually Pull one submission with durable confirmation recovery.

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
