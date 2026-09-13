# System Diagrams (Visual Previews & Sources)

This directory contains the visual diagrams and PlantUML source files for the **CYF Christian School Organization Management System**.

---

## 1. Entity-Relationship Diagram (ERD)

### Visual Preview
![ERD Preview](./erd.svg)

### Native Markdown ERD (Mermaid)

```mermaid
erDiagram
    roles ||--o{ users : assigns
    users ||--o{ user_ministries : has
    ministries ||--o{ user_ministries : "assigned to"
    households ||--o{ members : contains
    ministries ||--o{ members : "belongs to"
    users ||--o| members : "links account"
    users ||--o{ events : organizes
    events ||--o{ event_rsvps : receives
    members ||--o{ event_rsvps : registers
    members ||--o{ attendance : "checked in"
    events ||--o{ attendance : "recorded for"
    users ||--o{ documents : authors
    events ||--o{ documents : "relates to"
    documents ||--o{ document_approval_steps : "workflow steps"
    funds ||--o{ donations : "credits to"
    members ||--o{ donations : "contributed by"

    users {
        int id PK
        string name
        string username
        string email
        string password_hash
        int role_id FK
        timestamp created_at
    }

    members {
        int id PK
        string first_name
        string last_name
        date birthdate
        string gender
        string contact_email
        int household_id FK
        int ministry_id FK
        int user_id FK
        string status
    }

    events {
        int id PK
        string title
        text description
        timestamp start_time
        timestamp end_time
        string location
        int ministry_id FK
        int created_by FK
        int max_capacity
    }

    documents {
        int id PK
        string title
        string doc_type
        string file_url
        int current_version
        string current_status
        int submitted_by FK
        int event_id FK
    }

    funds {
        int id PK
        string name
        text description
        decimal target_amount
        int is_active
    }

    donations {
        int id PK
        int member_id FK
        int fund_id FK
        decimal amount
        string payment_method
        timestamp donated_at
    }
```

*PlantUML Source file:* [`erd.puml`](./erd.puml)

---

## 2. Document Approval & Versioning Flowchart

### Visual Preview
![Document Flowchart Preview](./document_approval_flowchart.svg)

### Native Markdown Flowchart (Mermaid)

```mermaid
flowchart TD
    Start([Start]) --> OpenDoc[Officer accesses Document Module]
    OpenDoc --> SelectType[Select Document Type: Proposal / Budget / Resolution]
    
    subgraph Automation [System Automation]
        SelectType --> AutoPop[Auto-populate Organization Info & Logo]
        AutoPop --> CalcBudget[Auto-calculate Budget Totals]
        CalcBudget --> GenPDF[Generate Standardized PDF v1.0]
    end
    
    GenPDF --> Submit[Submit Document: Status = UNDER_REVIEW]
    Submit --> NotifyP[Notify President / Committee Head]
    
    NotifyP --> Dec1{First Review?}
    Dec1 -- Approved --> ReqAdv{Requires Adviser Approval?}
    Dec1 -- Rejected --> Rej[Set Status: REJECTED] --> EndRej([End / Log Rejection])
    
    ReqAdv -- Yes --> AdvRev[Forward to Organization Adviser]
    ReqAdv -- No --> Appr[Set Status: APPROVED] --> Archive[Archive & Lock Version] --> EndAppr([End / Processed])
    
    AdvRev --> DecAdv{Adviser Decision?}
    DecAdv -- Approved --> Appr
    DecAdv -- Revision Requested --> RevReq[Set Status: REVISION_REQUIRED]
    RevReq --> NotifyAuthor[Notify Document Author]
    NotifyAuthor --> SelectType
```

*PlantUML Source file:* [`document_approval_flowchart.puml`](./document_approval_flowchart.puml)

---

## 3. Event Registration & QR Attendance Flowchart

### Native Markdown Flowchart (Mermaid)

```mermaid
flowchart TD
    Start([Start]) --> CreateEvent[Officer Creates Event / Activity]
    CreateEvent --> Publish[Publish Event & Send Announcement]
    
    subgraph MemberFlow [Member Registration]
        Publish --> MemberRSVP[Member submits RSVP / Registration]
        MemberRSVP --> CapCheck{Capacity Reached?}
        CapCheck -- Yes --> Waitlist[Place in Waiting List] --> EndWait([End])
        CapCheck -- No --> Confirmed[Confirm RSVP & Generate Unique QR Code]
    end
    
    subgraph EventDay [Event Day Attendance]
        Confirmed --> Arrive[Participant Arrives at Venue]
        Arrive --> Method{Check-in Method?}
        Method -- QR Scanner --> ScanQR[Scan QR Code via Camera]
        Method -- Manual --> SearchID[Search Name / Student ID]
        ScanQR --> LogAtt[Record Attendance: Status = PRESENT / LATE]
        SearchID --> LogAtt
    end
    
    subgraph Reporting [Automated Post-Event Automation]
        LogAtt --> CalcRate[Auto-calculate Attendance % & Metrics]
        CalcRate --> CertCheck{Certificates Required?}
        CertCheck -- Yes --> BulkCert[Bulk-generate Personalized PDF Certificates]
        CertCheck -- No --> Done[Update Dashboard & Accomplishment Report]
        BulkCert --> Done
    end
    Done --> EndFlow([End])
```

*PlantUML Source file:* [`event_attendance_flowchart.puml`](./event_attendance_flowchart.puml)

---

## 4. End-to-End System Flowchart (Comprehensive Architecture & Lifecycle)

### Native Markdown Flowchart (Mermaid)

```mermaid
flowchart TD
    Start([User Login / Authentication]) --> AuthCheck{Valid Credentials?}
    AuthCheck -- No --> AuthFail[Show Error Message] --> EndFail([Stop])
    AuthCheck -- Yes --> LoadRole[Load User Role & Scoped Ministries]
    LoadRole --> RouteDash[Dynamic Dashboard Router]

    RouteDash --> ModSelect{Module Selection}

    %% Module 1: Member Directory
    ModSelect -->|Members & Families| MemMod[Member & Household Management]
    subgraph M1 [Member Management]
        MemMod --> MemCRUD[Add / Edit Member Demographics & Households]
        MemCRUD --> MemMinistry[Assign Age-Bracket Ministry & Roles]
        MemMinistry --> Audit1[(Audit Trail)]
    end

    %% Module 2: Small Groups
    ModSelect -->|Discipleship| BSMod[Bible Study & Small Groups]
    subgraph M2 [Small Groups]
        BSMod --> BSCfg[Assign Leader, Schedule & Capacity]
        BSCfg --> BSCurr[Track Topic Progress & Chapter Studies]
    end

    %% Module 3: Events & Attendance
    ModSelect -->|Events & Check-In| EvtMod[Events, RSVP & Security Check-In]
    subgraph M3 [Events & Attendance]
        EvtMod --> EvtCreate[Create Event & Broadcast Announcements]
        EvtCreate --> RSVPFlow[Member Online RSVP / Waiting List]
        RSVPFlow --> EventDay[Event Day QR / Manual Check-In]
        EventDay --> SecTag[Issue Child & Family Security Tag]
        SecTag --> AttMetrics[Calculate Attendance % & Bulk Certificates]
    end

    %% Module 4: Rosters & Service
    ModSelect -->|Service Rosters| RostMod[Duty Teams & Dishwashing Rosters]
    subgraph M4 [Duty & Rosters]
        RostMod --> SatTeam[Saturday Cleaning & Service Rotation]
        RostMod --> SunDish[Sunday Fellowship Meal Rotation & Volunteers]
    end

    %% Module 5: Giving & Financials
    ModSelect -->|Stewardship| FinMod[Funds, Donations & Stewardship]
    subgraph M5 [Financial Management]
        FinMod --> FundCreate[Create Campaign Funds & Target Goals]
        FundCreate --> DonRecord[Record Tithes, Offerings & Payment Methods]
        DonRecord --> FinSummary[Budget vs. Actuals & Financial Reports]
    end

    %% Module 6: Document Management
    ModSelect -->|Documents & Approvals| DocMod[Document Workflow & Approvals]
    subgraph M6 [Document Approvals]
        DocMod --> DocGen[Auto-Populate Headers & Generate PDF]
        DocGen --> DocReview{President / Adviser Review}
        DocReview -- Approved --> DocAppr[Set APPROVED & Digital Archiving]
        DocReview -- Revision --> DocRev[Set REVISION_REQUIRED & Resubmit]
        DocReview -- Rejected --> DocRej[Set REJECTED]
    end

    %% System Persistence
    M1 & M2 & M3 & M4 & M5 & M6 --> Sync[PostgreSQL DB Sync & Audit Logging]
    Sync --> LiveKPI[Refresh Dashboard KPI Cards & In-App Alerts]
    LiveKPI --> EndSync([Complete / Real-Time Sync])
```

*PlantUML Source file:* [`system_flowchart.puml`](./system_flowchart.puml)
