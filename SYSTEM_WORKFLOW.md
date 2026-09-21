# Daet Presbyterian Church Management System (ChMS) — System Workflow & Architecture Documentation

## 1. System Overview

The **Daet Presbyterian Church Management System (DPC ChMS)** is a comprehensive church management platform engineered to automate administrative operations, discipleship tracking, service management, financial stewardship, and rotating ministry duties.

The system is designed with a **hybrid local-first and cloud-ready architecture**, running as a responsive web application as well as a packaged **Electron desktop application** with support for multi-workstation local area network (LAN) synchronization and remote Supabase cloud backups.

---

## 2. System Architecture & Tech Stack

```
+-----------------------------------------------------------------------------+
|                               Presentation Layer                            |
|  • React 18 (Vite, TypeScript)            • Tailwind CSS (Indigo/Amber UI)  |
|  • Lucide React Icons                     • Responsive Sidebar + Navbar     |
|  • Electron Desktop Shell (Optional)      • Real-time Socket.io Client      |
+-----------------------------------------------------------------------------+
                                       │ HTTP REST / WebSocket
                                       ▼
+-----------------------------------------------------------------------------+
|                             Application Layer (API)                         |
|  • Node.js & Express (TypeScript)         • Role-Based Access Control (RBAC)|
|  • JWT Authentication Middleware          • Socket.io Event Broadcaster     |
|  • Automated Cycle Scheduling Engines     • Backup & Cloud Sync Service     |
+-----------------------------------------------------------------------------+
                                       │ SQL Queries / Pooling
                                       ▼
+-----------------------------------------------------------------------------+
|                              Persistence Layer                              |
|  • PostgreSQL Database                    • 23 Core Relational Tables       |
|  • Indexed Search & Foreign Keys          • Supabase Remote Replication     |
+-----------------------------------------------------------------------------+
```

### Key Technologies
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons, Socket.io Client
- **Backend:** Node.js, Express, TypeScript, Socket.io, Postgres client (`postgres` npm driver)
- **Database:** PostgreSQL (with transaction pooling, connection retry, and migration scripts)
- **Desktop Runtime:** Electron with native system tray and LAN server auto-detection
- **Synchronization:** Bidirectional Cloud Sync with Supabase / Remote Postgres

---

## 3. User Roles & Permission Hierarchy

The system enforces granular Role-Based Access Control (RBAC) across 5 core user roles:

| Role | Scope & Permissions | Target Users |
|---|---|---|
| **Admin** | Unrestricted access across all ministries, users, audit logs, financial data, settings, database backup/restore, and cloud sync. | Senior Pastor, Head Administrator, IT Coordinator |
| **Coordinator** | Management access over assigned ministries (Members, Attendance, Groups, Events, Communications, Reports). | Ministry Directors, Department Heads |
| **Leader** | Dedicated **Leader Portal** to manage assigned Bible Study groups, record group attendance, track curriculum progress, and view member profiles. | Bible Study Leaders, Cell Group Facilitators |
| **Volunteer** | Operational check-in/check-out kiosk execution, Sunday duty tasks, and event assistance. | Service Ushers, Check-in Desk Volunteers |
| **Member** | Read-only personal profile access, personal Bible reading plan tracker, event registration, and church announcements. | Church Members, Regular Attendees |

---

## 4. Ministries Structure

The church is organized into **7 Age-Bracket Ministries**:
1. **Kinder** (Ages 3–5)
2. **Elementary** (Ages 6–12)
3. **Highschool** (Ages 13–16)
4. **Youth** (Ages 17–21)
5. **Young Adult** (Ages 22–35)
6. **Junior Adult** (Ages 36–50)
7. **Old Adult** (Ages 51+)

---

## 5. End-to-End System Workflows

```mermaid
flowchart TD
    A([User Access]) --> B{Authentication}
    B -->|Valid JWT| C[Role Authorization]
    
    C -->|Admin| D[Full Church Administration Dashboard]
    C -->|Coordinator| E[Ministry Scoped Management]
    C -->|Leader| F[Leader Portal & Cell Groups]
    C -->|Volunteer| G[Check-In Kiosk & Service Duty]
    C -->|Member| H[Member Profile & Bible Reading]

    subgraph SundayCycle [Sunday Service Operational Cycle]
        I[Sunday Check-In / QR Security Tag] --> J[Live Attendance Roster]
        J --> K[Sunday Events Cycle]
        K --> L[Dishwashing Fellowship Rotation]
    end

    subgraph WeeklyDiscipleship [Weekly Discipleship & Ministry Cycle]
        M[Saturday Cleaning & Duty Teams]
        N[Bible Study / Small Groups & Curriculum]
        O[Daily Bible Reading Tracker]
    end

    subgraph AdministrationStewardship [Administration & Stewardship]
        P[Member & Household Management]
        Q[Tithe & Fund Management]
        R[Audit Trail & System Reporting]
        S[Local Backup & Cloud Sync]
    end

    D --> SundayCycle
    D --> WeeklyDiscipleship
    D --> AdministrationStewardship
```

---

### Workflow 5.1: Authentication & Server Configuration

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as Web/Desktop Client
    participant AuthAPI as Auth Service (/api/auth)
    participant DB as PostgreSQL Database

    alt Initial Setup / LAN Switch
        User->>Client: Press [Ctrl + P] or click Server Config
        Client->>Client: Open SystemConfigurationModal
        User->>Client: Enter Server IP / Port & Test Connection
        Client->>AuthAPI: GET /api/settings/health
        AuthAPI-->>Client: Connection Verified (200 OK)
        Client->>Client: Save to LocalStorage & Reload
    end

    User->>Client: Submit Email/Username & Password
    Client->>AuthAPI: POST /api/auth/login
    AuthAPI->>DB: Query user + role + assigned ministries
    DB-->>AuthAPI: User record with password_hash
    AuthAPI->>AuthAPI: Verify bcrypt password hash
    AuthAPI-->>Client: Return JWT Token + User Profile & Scopes
    Client->>Client: Store token in LocalStorage / AuthContext
    Client->>Client: Route to role dashboard (Admin/Coordinator/Leader)
```

---

### Workflow 5.2: Member Management & Household Linking

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin / Coordinator
    participant Client as Members Page
    participant MemberAPI as /api/members
    participant DB as PostgreSQL

    Admin->>Client: Fill Member Registration Form (Birthdate, Contact, Civil Status, Baptism)
    Client->>Client: Auto-calculate Age and Suggest Ministry (e.g. Age 8 -> Elementary)
    Admin->>Client: Select Household or Create New Household Unit
    Client->>MemberAPI: POST /api/members
    MemberAPI->>DB: INSERT into households (if new)
    MemberAPI->>DB: INSERT into members (with household_id, ministry_id)
    MemberAPI->>DB: Log action in audit_logs
    DB-->>MemberAPI: Created Member Record
    MemberAPI-->>Client: Success Response
    Client->>Client: Real-time update Member Directory list & Statistics
```

#### Key Automation in Member Workflow:
- **Auto-Ministry Suggestion:** Dynamic mapping of birthdate to ministry bracket.
- **Aging-Out Alerts:** Identifies members who have aged out of their current ministry (e.g., Kinder entering Elementary).
- **Baptism Tracking:** Full lifecycle tracking (`not_baptized`, `candidate`, `baptized`) with baptism dates and notes.
- **Household Tree:** Linking parents, spouses, and children in unified family records.

---

### Workflow 5.3: Sunday Service & Check-In Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Parent / Attendee
    actor Usher as Check-In Volunteer
    participant Kiosk as Check-In Page
    participant AttAPI as /api/attendance
    participant DB as PostgreSQL
    participant Socket as Socket.io Broadcaster

    Attendee->>Usher: Arrive at Check-In Desk
    Usher->>Kiosk: Search Member Name or scan Member ID
    Kiosk->>AttAPI: GET /api/members/search
    AttAPI-->>Kiosk: Member Details + Ministry + Household
    Usher->>Kiosk: Tap "Check-In"
    alt Kinder or Elementary Ministry
        Kiosk->>Kiosk: Generate 4-digit Security Pickup Code (e.g. #K-4821)
    end
    Kiosk->>AttAPI: POST /api/attendance/check-in
    AttAPI->>DB: INSERT into attendance (member_id, ministry_id, security_code, timestamp)
    AttAPI->>Socket: Emit 'attendance:update' event
    Socket-->>Kiosk: Live Broadcast update to all connected stations
    
    Note over Attendee,Usher: After Service / Pickup Flow (Kinder/Elementary)
    Attendee->>Usher: Present Security Code for child checkout
    Usher->>Kiosk: Input Security Code to verify matching parent
    Usher->>Kiosk: Tap "Check-Out"
    Kiosk->>AttAPI: PUT /api/attendance/check-out/:id
    AttAPI->>DB: UPDATE attendance SET checked_out_at = NOW()
    AttAPI->>Socket: Emit 'attendance:update'
```

---

### Workflow 5.4: Discipleship & Bible Study Group Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Coordinator as Coordinator / Leader
    participant Portal as Bible Study / Leader Portal
    participant GroupAPI as /api/groups & /api/study-topics
    participant DB as PostgreSQL

    Coordinator->>Portal: Create Bible Study / Cell Group (Name, Schedule, Location, Curriculum)
    Portal->>GroupAPI: POST /api/groups
    GroupAPI->>DB: INSERT into bible_study_groups
    
    Coordinator->>Portal: Enroll Church Members into Group
    Portal->>GroupAPI: POST /api/groups/:id/members
    GroupAPI->>DB: INSERT into bible_study_members

    Note over Coordinator,Portal: Weekly Session Tracking & Progression
    Coordinator->>Portal: Update Chapter Progress (e.g. Topic: Romans -> Chapter 4)
    Coordinator->>Portal: Log Attendance for session & add notes
    alt Schedule Postponement / Emergency
        Coordinator->>Portal: Toggle Reschedule (Set new Date, Time, Reason)
        Portal->>GroupAPI: PUT /api/groups/:id/reschedule
        GroupAPI->>DB: UPDATE bible_study_groups (is_rescheduled = true)
    end
```

---

### Workflow 5.5: Sunday Dishwashing Fellowship Roster Workflow

To maintain order and fellowship harmony, after-service meal cleanup follows an automated rotational roster.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin / Coordinator
    participant UI as Dishwashing Page
    participant API as /api/dishwashing
    participant DB as PostgreSQL

    Admin->>UI: Select Roster Generation Mode (By Bible Study Group / By Ministry)
    Admin->>UI: Set Start Sunday Date & Number of Weeks
    UI->>API: POST /api/dishwashing/generate-roster
    API->>DB: Query active Bible Study groups / Ministries
    API->>API: Compute round-robin rotation & optional Joint Duty pairing
    API->>DB: INSERT INTO dishwashing_roster for each scheduled Sunday
    API-->>UI: Return generated schedule

    Note over Admin,UI: On Sunday Service Execution
    Admin->>UI: Mark duty as "Completed" / "Swapped" / "Rescheduled"
    UI->>API: PUT /api/dishwashing/:id/status
    API->>DB: UPDATE dishwashing_roster SET status = 'completed'
```

---

### Workflow 5.6: Saturday Duty & Cleaning Cycle Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Coordinator
    participant UI as Duty Management Page
    participant API as /api/duty
    participant DB as PostgreSQL

    Admin->>UI: Configure Duty Teams (Assign Members & Team Leader)
    UI->>API: POST /api/duty/teams
    API->>DB: INSERT into duty_teams & duty_team_members

    Admin->>UI: Generate Saturday Rotation Schedule (e.g. Team 1 -> Team 2 -> Team 3)
    UI->>API: POST /api/duty/schedules/generate
    API->>DB: INSERT into duty_schedules

    Note over Admin,UI: Saturday Inspection & Completion
    Admin->>UI: Verify tasks checklist (Sanctuary, Fellowship Hall, Restrooms)
    Admin->>UI: Mark schedule status as 'Completed'
    UI->>API: PUT /api/duty/schedules/:id
    API->>DB: UPDATE duty_schedules SET status = 'completed', completed_at = NOW()
```

---

### Workflow 5.7: Giving & Financial Stewardship Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Donor as Member / Giver
    actor Admin as Church Treasurer / Admin
    participant UI as Giving / Finance Page
    participant API as /api/finance
    participant DB as PostgreSQL

    Admin->>UI: Create or Manage Funds (General Fund, Building Fund, Missions, Youth Camp)
    Donor->>Admin: Offer Tithe / Donation (Cash, Bank Transfer, Online)
    Admin->>UI: Record Donation (Member Name, Fund ID, Amount, Payment Method, Notes)
    UI->>API: POST /api/finance/donations
    API->>DB: INSERT into donations
    API->>DB: Record Audit Log entry
    API-->>UI: Return transaction confirmation
    Admin->>UI: Generate Giving Statement / Financial Stewardship Report
    UI->>API: GET /api/finance/reports/summary
    API-->>UI: Aggregated breakdown per Fund, Payment Method, and Date Range
```

---

### Workflow 5.8: Church Communications & Announcements

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Pastor / Coordinator
    participant UI as Communications Page
    participant API as /api/communications
    participant DB as PostgreSQL
    participant Socket as Socket.io

    Staff->>UI: Compose Announcement (Title, Body, Target Ministry or Church-wide, Pin Status)
    UI->>API: POST /api/communications/announcements
    API->>DB: INSERT into announcements
    API->>Socket: Broadcast 'announcement:new'
    Socket-->>UI: Live banner update on Member & Dashboard views
```

---

### Workflow 5.9: Database Backup, Recovery & Cloud Sync

```mermaid
sequenceDiagram
    autonumber
    actor Admin as System Administrator
    participant UI as Settings / Backup Page
    participant BackupAPI as /api/backup & /api/cloud-sync
    participant LocalDB as Local PostgreSQL
    participant CloudDB as Supabase / Remote Postgres

    alt Local Database Backup
        Admin->>UI: Click "Create Database Backup"
        UI->>BackupAPI: POST /api/backup/export
        BackupAPI->>LocalDB: Generate SQL dump / table data snapshots
        BackupAPI-->>UI: Downloadable `.sql` / `.json` backup file
    end

    alt Cloud Synchronization
        Admin->>UI: Click "Sync with Cloud" or Auto-Sync Trigger
        UI->>BackupAPI: POST /api/cloud-sync/sync
        BackupAPI->>LocalDB: Fetch unsynced local mutations
        BackupAPI->>CloudDB: UPSERT changes to remote tables
        BackupAPI->>CloudDB: Pull remote updates to local database
        BackupAPI-->>UI: Return Sync Summary (Tables synced, Records updated)
    end
```

---

## 6. Page & Navigation Matrix

| Tab Identifier | Component Page | Primary Roles | Key Features |
|---|---|---|---|
| `dashboard` | `DashboardPage.tsx` | Admin, Coordinator | High-level metrics, attendance charts, upcoming duties, recent activity |
| `leaderportal` / `leader-dashboard` | `LeaderPortalPage.tsx` | Leader, Coordinator | Focused view of leader's Bible Study groups, members, attendance logging |
| `attendance` | `CheckInPage.tsx` | Admin, Coordinator, Volunteer | Live Sunday check-in, search, security code generator, live roster |
| `attendancelog` | `AttendanceLogPage.tsx` | Admin, Coordinator, Leader | Unified audit history of Sunday check-ins and Bible Study attendance with CSV/PDF exports |
| `members` | `MembersPage.tsx` | Admin, Coordinator | Directory grid/list, member profile modal, family tree, status filters |
| `biblestudy` | `BibleStudyPage.tsx` | Admin, Coordinator, Leader | Cell group management, curriculum tracker, reschedule manager |
| `curriculum` | `CurriculumPage.tsx` | Admin, Coordinator, Leader | Study topics, chapter outlines, teaching notes and study guides |
| `biblereading` | `BibleReadingPage.tsx` | All Users, Members | 365-day Bible reading plan, progress streaks, chapter bookmarks |
| `duty` | `DutyPage.tsx` | Admin, Coordinator, Leader | Saturday cleaning duty teams, rotation generator, checklist verification |
| `dishwashing` | `DishwashingPage.tsx` | Admin, Coordinator, Leader | Sunday fellowship lunch cleanup roster, joint group assignment |
| `events` | `EventsPage.tsx` | Admin, Coordinator | Church calendar, event registrations/RSVP, location scheduling |
| `sundaycycle` | `SundayEventsCyclePage.tsx` | Admin, Coordinator | Comprehensive master dashboard for all Sunday service logistics |
| `communications` | `CommunicationsPage.tsx` | Admin, Coordinator, Member | Church announcements, bulletins, prayer request management |
| `reports` | `ReportsPage.tsx` | Admin, Coordinator | Attendance trends, demographic charts, export to CSV/PDF |
| `users` | `UsersPage.tsx` | Admin | System user accounts, role assignments, ministry scopes |
| `audit` | `AuditPage.tsx` | Admin | Complete immutable security trail of database modifications |
| `settings` | `SettingsPage.tsx` | Admin | Church profile, system lookups, backup/restore, cloud sync setup |
| `profile` | `ProfilePage.tsx` | All Users | Personal account settings, password update, assigned scopes |

---

## 7. Database Entity Relationship Summary

```
                      +-------------------+
                      |       roles       |
                      +---------+---------+
                                | 1:N
                                ▼
+------------------+     +------+------+     +------------------+
|    ministries    |◀───M:N──|    users    |───1:N──▶|    audit_logs    |
+--------+---------+     +------+------+     +------------------+
         |                      |
         | 1:N                  | 1:N
         ▼                      ▼
+--------+---------+     +------+------+
|     members      |◀──1:N──| households  |
+--------+---------+     +-------------+
         │
         ├─── 1:N ──▶ attendance (Check-in/Check-out, Security Code)
         ├─── 1:N ──▶ event_registrations
         ├─── 1:N ──▶ donations (Tithes/Offerings -> funds)
         ├─── M:N ──▶ bible_study_members (-> bible_study_groups)
         └─── M:N ──▶ duty_team_members (-> duty_teams -> duty_schedules)
```

---

## 8. Operational Quick Guide

### System Shortcuts
- **`Ctrl + P` (or `Cmd + P`):** Open **System Configuration Modal** to change Database Server IP/Host without modifying environment files.

### Standard Weekly Church Operating Cycle
1. **Monday–Friday:** Member updates, Bible Study sessions logging via Leader Portal, Daily Bible Reading Plan check-ins.
2. **Friday Afternoon:** Automated check on Saturday Duty Team assignment & checklist distribution.
3. **Saturday Morning:** Saturday Cleaning Duty execution & completion confirmation.
4. **Sunday Morning (Pre-Service):** Check-In Kiosk startup, Sunday Events Cycle overview verification.
5. **Sunday Morning (During Service):** Attendance logging with pickup security codes for Kinder & Elementary.
6. **Sunday Noon (Post-Service):** Sunday Fellowship Lunch Dishwashing Roster execution & sign-off.
7. **Sunday Evening:** Auto-sync attendance data to Supabase Cloud & trigger weekly database backup.
