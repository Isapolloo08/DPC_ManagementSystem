# DPC Management System

Language for church event invitations and the proposed online-to-local submission workflow.

## Event invitations

**Invitation link**:
A shareable invitation to a church event through which a recipient can state whether they plan to attend. A personal link identifies a particular member; a general link accepts member or guest responses.

**Invitation response**:
A recipient's answer to an event invitation: Attending, Cannot attend, or Not yet sure. It expresses an intention to attend and can change before responses close.
_Avoid_: Attendance record, check-in

**Event registration**:
A member's planned participation status for an event. An invitation response may change this status, while actual arrivals are confirmed separately.

**Actual attendance**:
A person's confirmed arrival at an event, recorded through Event Attendance & Check-In.
_Avoid_: Invitation response, RSVP

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
