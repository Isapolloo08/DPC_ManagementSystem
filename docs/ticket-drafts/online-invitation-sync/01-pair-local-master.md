# Draft 1: Pair the Local Master with a verified online source

Publication status: approved and published as [GitHub issue #2](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/2). Delivery is recorded in the implementation notes; production rollout is separate.

## Parent

Part of [GitHub issue #1](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/1). The approved specification and ADR-0001 govern all tickets. No implementation, deployment or live database changes are authorized by drafting these tickets.

## What to build

An authorized local Admin pairs the Local Master once through an authorized cloud Admin and sees Ready, Not paired or Reconnect required in the existing settings experience. Every LAN client uses the same receiver and pairing. This slice establishes the usable security/readiness boundary; it does not yet discover or import submissions.

## Acceptance criteria

- [ ] Reuse existing local and cloud authentication and Admin/legacy IT Admin compatibility. Non-Admin and expired sessions cannot pair or inspect protected synchronization state; existing Pastor/Coordinator invitation management stays unchanged. A local JWT is never accepted as a cloud identity.

- [ ] Issue a narrowly scoped, source/receiver-bound, revocable integration credential through explicit cloud Admin authorization. Store it only in protected backend storage; do not retain cloud account passwords or expose secrets in renderer builds, API responses, logs or notifications.

- [ ] Persist stable source and Local Master receiver identity with additive, repeatable migrations. Gate Ready on required schema capabilities and pairing/source verification rather than basic HTTP health. Wrong source, wrong receiver, incompatible schema and revoked credentials fail with actionable status.

- [ ] Establish a read-only verification procedure for the intended online API/database correspondence, invitation hostname and hosting limits. Record unresolved deployment facts as explicit integration/rollout blockers; do not assume development and installed Cloud Sync databases match or silently rewrite their settings.

- [ ] Provide Admin-only pairing/status/reconnect UI using existing design patterns, accessible controls and light/dark states; share status across LAN clients without independent receivers. No public localhost exposure or extra infrastructure.

- [ ] Verify the real authentication/pairing HTTP boundary and persisted state in isolated PostgreSQL environments, plus the settings journey in Playwright. Cover restart persistence, revocation, identity/schema mismatch and absence of secrets. No live migrations or production pairing.

## Blocked by

None (can start immediately).

## Validation boundary

Reuse the approved authenticated Express API/persisted-outcome tests with isolated online/local PostgreSQL and supporting Playwright journeys. UI mocks do not prove atomicity or uniqueness. Do not write to production/cloud or the real local business schema. Report unavailable database checks as gaps. Complete checks affected by this slice; no application tests run as part of ticket drafting.
