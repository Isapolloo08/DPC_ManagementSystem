# RSVP member selection

Fixed [issue #10](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/10), October 12, 2026. Calendar RSVP previously submitted without a member ID and assumed the logged-in account had a linked member profile. Unlinked organizer accounts received `member_id is required`.

Calendar RSVP now opens a confirmation dialog. Admin, legacy IT Admin, Pastor and Coordinator users search existing active members within the event's target ministries and choose the person before saving. Ordinary users confirm their own linked profile. No member/profile is created automatically. An unlinked ordinary account receives an actionable explanation.

The authenticated endpoint validates event/member/planned status, restricts registration of another person to authorized organizers, checks target-ministry eligibility, and uses a single upsert for repeated/concurrent requests. RSVP cannot set or overwrite actual attendance statuses. Counts refresh from server data instead of incrementing after every click.

The real isolated PostgreSQL HTTP regression first reproduced the missing-member error, then passed missing/invalid selection, permissions, selected and linked-member saves, concurrent duplicates and checked-in preservation. The browser regression confirms an unlinked Admin must select a real member before saving and sends that member ID. Existing invitation and synchronization regressions were also checked. This change does not deploy the application, link user accounts or modify live registrations.
