---
status: accepted
---

# Confirm actual arrivals and finalize no-shows explicitly

On October 12, 2026 the user confirmed that Cannot attend responses should appear as Absent with their RSVP reasons, while expected participants without a confirmed arrival become Absent only when an organizer manually closes attendance. An accepted invitation never establishes Present: staff must confirm physical arrival, and closing is allowed after the scheduled event end so a future event cannot acquire premature no-show records.

The roster derives RSVP declines without creating pre-event check-ins; closing materializes remaining declines and no-shows atomically while preserving existing Present, Absent and Excused decisions. Reopening enables corrections without erasing those decisions. This extends ADR-0001's separation of intention from actual attendance: manual Pull and ordinary invitation changes must preserve confirmed decisions, including absences, while guest attendance belongs to the invitation respondent rather than an invented member profile.
