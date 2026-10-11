# Event workspace and special-event attendance

Tracked in [GitHub issue #11](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/11).

## Where to open it

Calendar -> select a church event -> Invitation Links & Responses opens a full event page. Invitations & responses contains link generation, response reasons, online previews and explicit manual Pull. Attendance & check-in opens actual attendance for that event. Open in Attendance Live selects the same event in Special Event Check-In; both locations use the same attendance panel.

## Attendance rules

| Invitation or action | Attendance result |
| --- | --- |
| Yes / registered | Expected, waiting for staff confirmation |
| Cannot attend | Absent from RSVP, showing the original reason |
| Not sure | Unconfirmed |
| Confirm present | Present only after staff confirms physical arrival |
| Record absent / excused | Explicit attendance decision with a required reason |
| Reset confirmation | Removes actual decision, retains invitation answer |
| Close attendance | After scheduled end, records remaining expected no-shows as Absent and materializes declines with their reasons |
| Reopen attendance | Allows corrections; preserves recorded attendance |

Expected & present is the default view. Present shows confirmed arrivals only; Absent / Excused keeps declined responses and reasons separate. Unconfirmed and All participants support review. Search, ministry/guest filtering and pagination keep the roster manageable. Uninvited members are not automatically counted absent. Add member walk-in adds planned participation through the existing member picker before explicit check-in.

Guest respondents have separate attendance records tied to their response. They are not converted into registered church members. Only event organizers can view and confirm guests. Administrators, IT Admin and Pastor organize all events; a Coordinator must own the event or share a target ministry. Other allowed attendance staff can record members within their assigned ministries and the event's target scope. Only organizers can close or reopen attendance.

## Data and integration

Migration 024 creates `event_guest_attendance` and `event_attendance_sessions`. Member attendance continues using `attendance` and `event_registrations`. Attendance writes, audit entries and close classification share one transaction and the existing invitation synchronization advisory lock. Failed writes roll back; repeated close does not duplicate rows. Closed events reject mark/reset operations through both new and legacy event endpoints.

Manual invitation Pull and RSVP updates preserve confirmed Present, Absent and Excused registration statuses. Broad Cloud Sync also preserves confirmed decisions at the invitation boundary. The Sunday attendance endpoints operate on Sunday rows only and direct special-event corrections to the event workspace. Full and yearly backup exports include guest attendance and closure records; restoration restores them after invitation responses without attempting serial-sequence resets for their nonserial keys.

Online discovery and previews still do not import business records. Previously unpulled submissions remain online until an authorized administrator explicitly pulls them. If new responses are pulled after attendance closes, reopen attendance to process them, then close again when ready.

## Updating an installation

Update client and backend together. The normal backend schema initialization applies migration 024 on restart. Back up the installation before updating. This implementation was verified in disposable PostgreSQL schemas and mocked browser journeys; live migration, production deployment and real invitation submissions were not performed by the agent.

## Verification

- Production client/backend build.
- PostgreSQL integration coverage: RSVP versus confirmed attendance, scoped authorization, guest arrival without member creation, mandatory absence reasons, rollback, early-close rejection, no-show closure, idempotent close, reopen and legacy endpoint protection.
- Real invitation synchronization and full backup restore coverage, including mutations after export and preservation of confirmed absence/excuse during subsequent Pull and broad transfer.
- Browser journeys in desktop light and mobile dark layouts: full event page, default roster, decline reason, explicit member/guest arrival, close/no-show, reopening and Attendance Live handoff.
- The full isolated backend suite still has existing date/time, baseline fixture and Windows process shutdown failures. Focused feature coverage passes separately.
