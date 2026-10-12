# DPC Management System

Language for church event invitations and the proposed online-to-local submission workflow.
Planned visit requests use the same manual discovery/import boundary, with distinct permissions and receipts.

## Planned visits

**Visit plan**: A visitor's optional request to attend Sunday worship, including contact consent and intended visit date.

**Visitor confirmation**: The visitor's Confirmed, Cancelled or Pending intention for a visit plan. It does not establish actual arrival.

**Visit management link**: A private bearer link allowing a visitor to confirm, cancel or reschedule their own visit plan.

**Visit submission revision**: A version of the same receipt after the visitor changes its date or reply. Importing it requires another explicit Pull; local staff notes are maintained separately.

## Event invitations

**Invitation link**:
A shareable invitation to a church event through which a recipient can state whether they plan to attend. A personal link identifies a particular member; a general link accepts member or guest responses.

**Invitation response**:
A recipient's answer to an event invitation: Attending, Cannot attend, or Not yet sure. It expresses an intention to attend and can change before responses close.
_Avoid_: Attendance record, check-in

**Event registration**:
A member's participation status for an event, initially planned and later updated when attendance is confirmed. Invitation changes do not replace confirmed attendance decisions.

**Actual attendance**:
A person's recorded attendance decision for an event: confirmed Present, Absent with a reason, or Excused with a reason.
_Avoid_: Invitation response, RSVP

**RSVP decline**:
A Cannot attend answer with the recipient's reason. It appears as Absent from RSVP until an attendance decision is recorded.

**No-show**:
An event participant or invitation respondent with no confirmed arrival when the organizer finalizes remaining absences. A no-show is recorded as Absent with a reason, including a respondent who previously answered Not yet sure.

**Closed event attendance**:
Attendance finalized by the organizer after the scheduled event ends. Corrections require reopening it; reopening preserves previously recorded decisions.

**Event attendance day**:
A Philippine calendar date within the event’s scheduled dates on which staff may record or reset actual attendance. Reopening attendance does not extend these dates.

**Sunday reflection**:
An event’s optional link to Sunday Worship attendance. Confirmed member arrivals can also establish Sunday Present. The organizer may explicitly include remaining event participants in Sunday absences when finalizing. Existing Sunday decisions are preserved; guests remain event-only.

## Online-to-local submissions

**Online submission**:
An invitation response accepted and retained by the online system, available for an authorized administrator to retrieve locally.

**Pending online submission**:
An online submission whose current answer has not yet been imported into the receiving local system. A changed online answer becomes pending again; an invited member who has not answered is a different case.
_Avoid_: Unanswered invitation, unread notification

**Submission revision**:
A particular version of an online invitation response. Changing the answer creates a newer revision, even when the respondent and invitation remain the same.

**Pull**:
An authorized administrator's explicit action to retrieve and import online submissions into the local system.
_Avoid_: Automatic import, notification refresh

**Submission notification**:
An in-app alert that online submissions are available for synchronization. Reading the alert does not perform a Pull.

**Synchronized submission**:
An online submission revision successfully imported into the receiving local system and confirmed to the online system. Reading or dismissing a notification does not establish synchronization.

**Locally imported submission**:
A submission revision whose local save has succeeded. It may still be awaiting confirmation to the online system.

**Confirmation pending**:
The state of a locally imported submission whose successful import has not yet been confirmed online. It needs confirmation rather than another import.
_Avoid_: Import failed, not imported

**Local Master**:
The DPC installation that owns the authoritative local database shared by its LAN clients. Online submissions are pulled into that shared database.
