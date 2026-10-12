---
status: accepted
---

# Confirm actual arrivals and finalize no-shows explicitly

On October 12, 2026 the user confirmed that Cannot attend responses should appear as Absent with their RSVP reasons, while expected participants without a confirmed arrival become Absent only when an organizer manually closes attendance. An accepted invitation never establishes Present: staff must confirm physical arrival, and closing is allowed after the scheduled event end so a future event cannot acquire premature no-show records.

The roster derives RSVP declines without creating pre-event check-ins; closing materializes remaining declines and no-shows atomically while preserving existing Present, Absent and Excused decisions. Reopening enables corrections without erasing those decisions. This extends ADR-0001's separation of intention from actual attendance: manual Pull and ordinary invitation changes must preserve confirmed decisions, including absences, while guest attendance belongs to the invitation respondent rather than an invented member profile.

On October 13, 2026 the user restricted actual attendance marking to the event’s scheduled Philippine calendar dates. This applies to members, guests, batch marking, resets, and legacy attendance routes. Future and past events remain available for review; reopening does not bypass the date restriction. Absence finalization remains an explicit organizer action after the scheduled event end and can still be performed later.

The user also clarified that the organizer should finish marking arrivals, then trigger one reviewed action to mark remaining event participants and voters Absent, including Not sure replies. This replaces the earlier behavior that left Not sure replies unconfirmed when closing. A linked Sunday service can be included through an explicit checkbox in this review. Only event participants are included; guests remain event-only. Existing event decisions and every existing Sunday record, including Present and Excused, are preserved. Preview changes require a fresh review, and event/Sunday absence writes commit together or roll back together. Nothing finalizes automatically.
