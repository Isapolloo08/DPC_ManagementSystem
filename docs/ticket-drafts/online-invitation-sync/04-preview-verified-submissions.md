# Draft 4: Preview a pending submission and explain blocked parent mappings

Publication status: approved and published as [GitHub issue #5](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/5). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

An Admin opens a pending submission in the event invitation modal, requests a transient preview and sees whether its existing local event/member/invitation counterparts can be verified. Missing or ambiguous correspondence is explained without creating or importing parent records.

## Acceptance criteria

- [ ] Fetch name/contact/answer/reason only on explicit authorized preview, through the backend's scoped pairing. Safely render as data; do not persist sensitive preview details locally, create business records/receipts or send import confirmation.

- [ ] Clear preview and cancel further preview requests on logout/expiry, including discarding late responses. Source revocation, wrong source/receiver, unavailable service and unsupported schema produce meaningful status without stale sensitive details.

- [ ] Validate mapping/provenance through stable identities and existing verified publication/transfer relationships. Persist only justified mapping metadata; equal integer IDs or names alone are insufficient. Expose missing/conflicting event/member/invitation, missing source data and unsupported legacy mappings as blockers.

- [ ] Provide a reusable backend eligibility/validation boundary that the subsequent Pull rechecks independently. Preserve member/guest distinction, allowed answer values, decline reason, field limits and retrieval after closure. Do not reserve the preview revision or promise it will be the answer later imported.

- [ ] Show actionable reasons in the existing pending panel with no automatic parent creation/import, destructive cleanup, guest membership/account creation or new general-purpose repair interface. Keep existing role scope, UI tokens and accessibility.

- [ ] Test explicit preview HTTP authorization and persisted no-import/no-ack outcomes in isolated PostgreSQL, including legacy mapping collisions and closure. Playwright verifies on-demand sensitive data, blocked explanation, safe rendering and logout/late-response clearing.

## Blocked by

- GitHub issue #4: Discover pending online submissions through the notification bell.

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
