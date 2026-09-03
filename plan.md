# Church Management System — Development Plan

## Overview
A church management system (ChMS) supporting 7 ministries with role-based access across 4 user tiers.

**Ministries:** Kinder, Elementary, Highschool, Youth, Young Adult, Junior Adult, Old Adult
**Roles:** Admin, Coordinator, Volunteer, Member

---

## Phase 1: Foundation (Auth & Roles)
- [ ] User authentication (email/password, optional OAuth)
- [ ] Role-based access control (Admin, Coordinator, Volunteer, Member)
- [ ] Ministry model + seed 7 ministries
- [ ] Assign users to one or more ministries (Coordinator/Volunteer)
- [ ] Permission middleware (scope data access by role + ministry)

## Phase 2: Member Management
- [ ] Member profile CRUD (name, birthdate, contact, photo)
- [ ] Household/family linking (parents ↔ children across ministries)
- [ ] Ministry assignment (manual + age/grade auto-suggestion)
- [ ] Member status (active, inactive, visitor)
- [ ] Ministry "aging out" alerts (e.g., Kinder → Elementary)

## Phase 3: Attendance
- [ ] Attendance logging per ministry/service
- [ ] Check-in/check-out flow (Kinder & Elementary, with security tag matching)
- [ ] Attendance history view per member
- [ ] Attendance trend reports per ministry

## Phase 4: Events & Scheduling
- [ ] Ministry-specific event calendar
- [ ] Church-wide calendar (aggregated, Admin view)
- [ ] Event registration/RSVP for Members
- [ ] Volunteer scheduling/rotation per ministry

## Phase 5: Communication
- [ ] Ministry-scoped announcements (Coordinator → their ministry)
- [ ] Church-wide broadcast (Admin only)
- [ ] Prayer request submission and tracking
- [ ] Email/SMS notification integration

## Phase 6: Giving & Finance (optional scope)
- [ ] Member/family giving records
- [ ] Fund allocation (general, missions, ministry-specific funds)
- [ ] Giving statements (for tax purposes)
- [ ] Admin-only financial reports

## Phase 7: Reporting & Analytics
- [ ] Attendance trends (per ministry, church-wide)
- [ ] Membership growth/retention metrics
- [ ] Volunteer participation reports
- [ ] Consolidated Admin dashboard

## Phase 8: Polish & Launch
- [ ] Audit log (track changes by Admin/Coordinator)
- [ ] Data privacy review
- [ ] Mobile responsiveness pass
- [ ] User acceptance testing per role
- [ ] Deployment

---

## Color Palette

| Name | Hex | Role |
|---|---|---|
| Indigo | `#2C3968` | Primary — headers, nav, trust & depth |
| Amber | `#D9A441` | Secondary — highlights, candle-warmth |
| Sage | `#6E8B74` | Accent — growth, active/success states |
| Muted Rose | `#B85C56` | Accent — alerts, youth-facing sections |
| Ivory | `#F5F0E6` | Background — light surfaces |
| Charcoal | `#292520` | Text — body copy, dark surfaces |

**Usage:** Indigo for primary actions & navigation, Amber for calls-to-attention (giving, events), Sage for confirmations/active status, Rose sparingly for alerts. Ivory/Charcoal as the base neutral pair.

---

## Database Schema

### Core Tables

**roles**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | varchar | Admin, Coordinator, Volunteer, Member |

**ministries**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | varchar | Kinder, Elementary, Highschool, Youth, Young Adult, Junior Adult, Old Adult |
| min_age | int | nullable, for auto-assignment |
| max_age | int | nullable, for auto-assignment |

**users**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | varchar | |
| email | varchar | unique |
| password_hash | varchar | |
| role_id | FK → roles.id | |
| created_at | timestamp | |

**user_ministries** (many-to-many: Coordinators/Volunteers can serve multiple ministries)
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| user_id | FK → users.id | |
| ministry_id | FK → ministries.id | |

**households**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | varchar | e.g. "The Santos Family" |
| address | text | |

**members**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| first_name | varchar | |
| last_name | varchar | |
| birthdate | date | drives ministry auto-suggestion |
| gender | varchar | |
| contact_email | varchar | nullable |
| contact_phone | varchar | nullable |
| household_id | FK → households.id | nullable |
| ministry_id | FK → ministries.id | current ministry |
| user_id | FK → users.id | nullable, if member has portal login |
| status | varchar | active, inactive, visitor |
| photo_url | varchar | nullable |
| created_at | timestamp | |

### Attendance & Events

**events**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| ministry_id | FK → ministries.id | nullable = church-wide |
| title | varchar | |
| description | text | |
| start_time | timestamp | |
| end_time | timestamp | |
| location | varchar | |
| created_by | FK → users.id | |

**event_registrations**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| event_id | FK → events.id | |
| member_id | FK → members.id | |
| status | varchar | registered, attended, cancelled |

**attendance**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| member_id | FK → members.id | |
| ministry_id | FK → ministries.id | |
| event_id | FK → events.id | nullable, for recurring service attendance |
| checked_in_at | timestamp | |
| checked_out_at | timestamp | nullable, for Kinder/Elementary |
| checked_in_by | FK → users.id | volunteer/coordinator who logged it |

### Communication

**announcements**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| ministry_id | FK → ministries.id | nullable = church-wide |
| author_id | FK → users.id | |
| title | varchar | |
| body | text | |
| created_at | timestamp | |

**prayer_requests**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| member_id | FK → members.id | nullable if anonymous |
| ministry_id | FK → ministries.id | nullable = church-wide |
| request_text | text | |
| status | varchar | open, answered, archived |
| created_at | timestamp | |

### Giving & Finance (optional scope)

**funds**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | varchar | General, Missions, Building, Youth Camp, etc. |
| description | text | |

**donations**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| member_id | FK → members.id | nullable if anonymous |
| fund_id | FK → funds.id | |
| amount | decimal | |
| method | varchar | cash, bank transfer, online |
| donated_at | timestamp | |

### Audit

**audit_logs**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| user_id | FK → users.id | |
| action | varchar | create, update, delete |
| target_table | varchar | |
| target_id | int | |
| created_at | timestamp | |

### Key Relationships
- `users` ↔ `ministries` — many-to-many via `user_ministries` (a Coordinator/Volunteer can serve multiple ministries)
- `members` → `households` — many-to-one (family grouping)
- `members` → `ministries` — many-to-one (current ministry, reassigned as they age)
- `attendance` → `members` + `ministries` + `events` — tracks who showed up, where, when
- `donations`/`announcements`/`prayer_requests` scoped by `ministry_id` (nullable = church-wide)

---

## Suggested Tech Stack
- **Backend:** Node.js / Express, PostgreSQL
- **Frontend:** React
- **Auth:** JWT-based sessions with role/ministry claims
- **Hosting:** Docker Compose for local/staging

## Open Questions
1. Can a Coordinator manage more than one ministry?
2. Can Volunteers float across ministries, or are they locked to one?
3. Can a Member belong to more than one ministry simultaneously (e.g., a Young Adult who also volunteers in Kinder)?
4. Is Giving & Finance in scope for v1, or a later phase?
