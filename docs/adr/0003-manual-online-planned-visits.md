---
status: accepted
---

# Discover online visit plans and import them manually

The user confirmed on October 12, 2026 that the public church website's existing Plan a visit form is the source of online visit plans. Admin, Pastor and legacy IT Admin accounts receive notifications and may preview and manually Pull requests. This permission extends Planned Visits only; invitation imports and cloud pairing remain Admin-only as specified in ADR-0001.

The existing Local Master pairing supplies the backend integration credential. Approximately 30-second outbound polling while an authorized staff socket is active discovers minimal metadata, with connection/startup checks and failure backoff. There is no public exposure of localhost or automatic business-data import. Cached availability remains available when offline.

A private visitor link allows confirm, cancel and reschedule to another upcoming Sunday. Responses increment a stable receipt's revision; opening the link does not change the response. Changed revisions require a new manual Pull. Same-action retries are idempotent and stale conflicting actions are rejected. Confirmation means an intention to visit, never actual arrival.

Each explicitly selected visit commits independently with a durable source/receiver/receipt/revision record. Remote acknowledgement follows local commit and failed acknowledgement retries without importing again. Staff notes and confirmed Visited decisions are preserved. Moving a Visited record to another date is blocked for staff review. New visits do not create members or attendance records. Pending online visits are protected from deletion and truncation.

Full Local Master backups include visits and receipts; restored receipts are re-confirmed against retained online revisions. Existing broad Cloud Sync does not copy planned_visits and must not become an automatic import path. No new infrastructure or packages are required.
