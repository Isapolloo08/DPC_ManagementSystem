# Online Planned Visits

Implemented for [issue #14](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/14), with decisions in ADR-0003. The public website uses `https://dpc-managementsystem.onrender.com/api/planned-visits`. Its deployed script was inspected read-only; no live visitor request was submitted during validation.

Visitors optionally submit the existing Plan a visit form. Its receipt screen and existing confirmation email contain a private link to `https://daetpresbyterianchurch.vercel.app/#/visit/<token>`. The visitor can confirm, cancel or select another Sunday. The link is a bearer secret, uses the URL fragment, and is sent to the backend only in a POST body. It exposes the visit date, party, reply and revision, not staff notes or contact details. The interface can reload after uncertain failures; stale edits require a reload. Past-date changes require contacting the church. A rescheduled visit returns to Pending confirmation.

Admin and Pastor users see an in-app bell notification linking to Planned Visits. The Pending online visits panel provides a metadata table, preview, pagination, page selection, Select all pending across pages, and manual Pull Selected in batches of 25. Automatic checks do not import visits. Existing pairing is configured once by an Admin in Settings & Backups; Pastor users reuse it without cloud passwords. Opening or reading a notification is not a Pull.

The local table retains staff follow-up notes and status. Visitor confirmation is shown separately from New/Contacted/Visited/Cancelled. A cancellation can set a non-Visited local record to Cancelled; a renewed visitor plan resets a cancelled record to New. A Visited record stays Visited; a later request to move that arrival to another date is blocked for staff review. No members or attendance records are generated.

## Release order

1. Deploy the updated management backend on Render so schema initialization applies migration `026_planned_visit_sync.sql` and exposes the protected source routes and visitor management endpoint. Migration adds columns and tables without deleting data.
2. Publish the corresponding landing-page changes from sibling `C:/Users/MARK ANGELO/DPC_LandingPage` to Vercel. Build-time `VITE_API_BASE_URL` must point at the Render API. Optional backend `PUBLIC_VISIT_WEBSITE_URL` defaults to the existing HTTPS church website; use it only if the public origin changes.
3. Restart/rebuild the Local Master backend and management client. The same migration runs locally. Reuse its existing paired source and encryption key. Full backups now include planned visits and import receipts; older backups lacking visits preserve existing local visits during replacement.
4. Log in as Admin or Pastor, choose Check online, preview a pending request, and explicitly Pull it. Verify the bell count and local staff workflow. Test visitor actions with a consented test request; do not infer rollout success from builds alone.

The implementation has not deployed either website or modified live visitor records. New visitor links require both updated backend and public frontend. Earlier confirmation emails are not resent automatically; repeated original submissions return the same receipt and management link. Broad Supabase Push/Pull currently omits planned_visits, preserving the manual boundary.

## Validation

Server, management client and public landing-page builds pass. PostgreSQL integration checks cover discovery without import, Admin/Pastor permissions, commit failure without acknowledgement, interrupted confirmation, concurrent duplicate Pull, skipped revisions, staff-note and arrival preservation, offline cache, visitor retries/stale changes, source API privacy/authentication, pending-row retention, and receipt restore provenance. Existing planned-visit and cloud-transfer checks passed together (17 checks). Eight browser cases passed across management light/dark desktop/mobile and visitor actions on desktop/mobile. API calls in browser tests were intercepted; real PostgreSQL tests used disposable schemas, not live business records.

Run cross-repository visitor browser cases with the landing preview running and `PLAYWRIGHT_VISIT_WEBSITE_URL` set to its origin (for example `http://127.0.0.1:5175`). They skip when the preview is not configured. The landing repository already contained unrelated uncommitted form/email-status and documentation changes; these were preserved, and its feature changes remain available for review in that working tree.
