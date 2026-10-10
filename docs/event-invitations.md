# Event invitation links

In Calendar, select a church event and open **Invitation Links & Responses**. Organizers can generate a general member/guest link or a personal link for a member, set a response deadline, copy links, deactivate them, and review responses. Coordinators can manage their own events or events within their assigned ministries.

The public page needs no account. General links offer Regular Member and Guest. Regular members type one or more letters in a single autocomplete input and select their canonical name from active members in the event ministry (All-Church includes all ministries). Only IDs and names are returned, up to 10 matches. Guests enter their name and contact details; personal links identify the invited member automatically. Answers are Attending, Cannot attend (reason required), or Not yet sure. Personal links retain one response per member/event. General links retain one response per browser receipt; they cannot prove a guest's identity or count people who have not replied. Changing browsers or clearing storage may create another guest response. Reasons and contact details are only returned by organizer endpoints.

Responses close at the configured deadline or event start, whichever comes first. All member answers synchronize planned RSVP registrations and retain one member response per event even across multiple links; they never insert actual attendance records. Actual arrivals still use Event Attendance & Check-In.

## Setup

For the existing Render API and a Vercel public invitation site, follow [the deployment guide](./vercel-event-invitations.md).

- Rebuild and restart the backend to apply additive migration `020_event_invitations.sql` and `021_invitation_member_responses.sql` and `022_event_ministries.sql` through the existing startup migration mechanism. This migration has been prepared; it has not been applied to a live database by this task.
- Local preview uses `http://localhost:3000/#/invite/<token>` and Vite's `/api` proxy.
- For outside-network access, host the frontend and API online. Configure `VITE_PUBLIC_API_URL=https://your-api.example.com` (or serve `/api` on the frontend origin). Rebuild the frontend after changing Vite environment variables.
- Set `VITE_PUBLIC_APP_URL=https://your-frontend.example.com/`, or enter that URL in the organizer's **Invitation website URL** field. That field is a local preference for link creation and does not deploy the app or change the guest API destination.
- Links use hash routing, so a static frontend host needs no invitation-specific routing rules. Use HTTPS. Keep personal links private: possessing the link allows submitting/updating that person's response.

Invitation tables are included in full/year backups, restore ordering, and cloud synchronization. Existing unrelated event APIs retain their behavior.

Validation includes backend permission/validation tests, light/dark and mobile browser API fixtures, and a disposable PostgreSQL 18 database exercising the migration twice, actual endpoint writes, repeat responses, registration synchronization, counts, link deactivation, and the required-reason constraint. No live database was changed. Production hosting still requires verification in its environment.

Member selection on a general link is self-declared and is not identity verification. Organizers still confirm actual attendance at check-in. Prefer personal links when a preselected identity is needed.

## Collaborative events

Target Ministry / Department and Calendar Host Ministries use checkboxes: select any number of ministries, or Church-wide for all active ministries. Annual definitions preserve all targets when scheduled into Calendar. Editing without ministry fields preserves the existing targets; an explicit empty ministry_ids array selects Church-wide. Existing single-ministry data is backfilled by migration 022, while the legacy ministry_id remains the first selected ministry for older consumers. Lists expose ministry_ids and a combined ministry label. Invitation membership search and personal-link validation cover every selected ministry. Coordinators may manage invitations if they created the event or belong to any targeted ministry.

Event/celebration ministry associations have foreign keys and composite primary keys; removed associations remain disabled for cloud synchronization. Full/year backups include the annual definitions and ministry associations.
