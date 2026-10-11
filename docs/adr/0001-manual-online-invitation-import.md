---
status: accepted
---

# Separate submission discovery from manual import

The administrator requires the local DPC application to discover online invitation submissions while retaining control over when they enter the local database. Automatic discovery may create notification and synchronization metadata, but invitation responses and their associated business records are imported only through an explicitly authorized Pull. Reading or dismissing a notification does not import or acknowledge the submission as synchronized.

Online submissions remain stored when the local system is offline. Communication is initiated from the local system toward the online service, so this feature does not require public exposure of localhost. Synchronization is recorded only after the local import transaction succeeds; any required remote acknowledgement follows that commit.

This boundary preserves the administrator's review step and local database integrity, at the cost of delayed local availability. The receiving system is one local Master database shared by its LAN clients, and this feature's notifications, previews and Pull actions are Admin-only. Approximately 30-second outbound availability checks while an authorized session is active, plus startup/reconnect checks, were accepted in interview round 1.

Online answers are authoritative and changed answers require another manual Pull; actual attendance remains untouched. Individual and selected Pull commit per response, and unverified parent identity blocks import. Existing broad Cloud Sync must preserve this boundary and cannot overwrite newer online-owned answers. The Master pairs once with an authorized cloud Admin using a narrowly scoped revocable backend credential.

Only minimal availability metadata is discovered automatically; sensitive previews are transient and cleared on logout. Unimported online responses do not expire automatically and are protected from destructive deletion; closure/deactivation does not prevent retrieving previously accepted answers. A failed online confirmation after local commit retries confirmation only. Receipts, mappings and receiver identity survive backup/restore, and restoration reconciles retained online revisions against actual local receipts rather than trusting previous cloud acknowledgement alone. Discovery requires the running Master and an authorized session, including tray use. The user confirmed these decisions and final shared understanding on October 11, 2026. External deployment verification remains a prerequisite tracked in the investigation record.
