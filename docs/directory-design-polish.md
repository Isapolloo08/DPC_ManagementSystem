# Shared directory design polish

Members & Families and Topics & Books of Study now share semantic surfaces, gold primary actions, soft status badges, neutral action controls, and visible focus rings. Routes, queries, API payloads, role checks, and save/delete handlers are unchanged. No dependencies were added.

## Audit

- Theme selection lives in client/src/context/ThemeContext.tsx: it applies the root dark class/data-theme and persists dpc_theme_mode in localStorage. The older Tailwind palette is in client/tailwind.config.js and generated CSS variables in client/src/index.css; semantic UI tokens are now centralized in client/src/design-tokens.css.
- Shared PageHeader, StatCard, Button, and UI CSS live in client/src/components/common. Sidebar and Navbar live in client/src/components/layout.
- MembersPage owns its table; MemberRowActions already supplies the accessible kebab menu. CurriculumPage owns its book cards and inspector.
- Found failing white-on-amber topic counts, violet merge chips, inline ministry color fallbacks, literal sidebar ministry swatches, and decorative shadow literals. These are now replaced or centralized in the touched UI.
- Service Calendar's old beige hover treatment could resemble selection. Navigation now uses one navy/gold active state and neutral surface-2 hover.
- The gold chevron was a floating sidebar scroll indicator, rather than a selector arrow. Its down control now has a reserved footer strip, so it cannot cover the designated ministry text.
- Active groups include both ongoing and completed non-merged groups. The Active tab therefore remains, with a tooltip explaining its meaning.

## Files changed in this pass

| File | Why |
| --- | --- |
| client/src/design-tokens.css | Centralized surface, status, accent, ministry, overlay and shadow variables; removed unused duplicate member badge palettes. |
| client/src/components/common/Button.tsx | Added the shared destructive variant. |
| client/src/components/common/ui.css | Gold primary buttons, neutral secondary text, destructive styles, shared shadows, focus rings and 150ms background/color transitions. |
| client/src/components/common/Badge.tsx | Added one reusable success/warning/danger/info/neutral badge. |
| client/src/components/common/badge.css | Shared 12px soft-fill badge styling backed by semantic tokens. |
| client/src/components/common/DialogPanel.tsx | Reused the existing dialog focus hook for keyboard focus, Escape and focus restoration. |
| client/src/components/common/directory-design.css | Shared directory surfaces, muted text, compact hero, placeholders, layout colors and reduced-motion behavior. |
| client/src/index.css | Imported the shared directory stylesheet. |
| client/src/components/layout/Sidebar.tsx | Centralized ministry swatches, stable icon sizing, truncated-name titles, and moved the overlapping scroll indicator. |
| client/src/components/layout/sidebar.css | Consistent active/hover nav states and fixed navigation geometry; reserved scroll-control space and 36px controls. |
| client/src/components/layout/Navbar.tsx | Applied shared layout styling, labelled the mobile navigation control, and replaced low-contrast live-sync status styling with shared badges. |
| client/src/components/help/HelpCenter.tsx | Removed the duplicate Start Here strip action; retained the top-bar launcher and contextual help. |
| client/src/pages/MembersPage.tsx | Reused shared gold Add Member button and status badges across table and member displays. Existing follow-up chip/filter and row actions remain. |
| client/src/pages/members.css | Replaced separate member badge palettes with shared variants and tokenized follow-up colors. |
| client/src/features/members/components/MemberDeleteDialog.tsx | Reused the shared dialog focus wrapper without changing deletion behavior. |
| client/src/pages/CurriculumPage.tsx | Flattened book cards, added a completion bar, aligned card actions, gold selected state, neutral merge/group chips, titles, scrollable inspector, sticky destructive footer, labelled fields, confirmation focus, compact hero and conditional pagination. |
| client/src/pages/curriculum.css | Added responsive card/inspector layouts and themed form styling. |
| tests/e2e/curriculum-polish.spec.ts | Mocked light/dark desktop/mobile coverage for contrast, theme persistence, inspector scrolling, confirmations, titles, small-list pagination, and coordinator sidebar geometry. |
| tests/e2e/page-design.spec.ts | Updated header expectations to the shared semantic colors and compact Topics title. |
| docs/directory-design-polish.md | Saved this audit, per-file changelog, contrast table, validation notes and remaining scope. |

Existing MemberRowActions was retained: Details and Edit stay visible; attendance intelligence, baptism milestones, greeting and Delete are in the keyboard-accessible kebab menu. Follow-up count still uses loaded members and says “on this page,” avoiding an incorrect global count.

## Badge contrast

Ratios use WCAG relative luminance. Dark translucent fills are composited over surface-2 (#17233A), the darker-theme lighter surface and conservative case for these two surfaces. Text/background ratios all exceed 4.5:1.

| Variant | Light text / fill | Ratio | Dark text / fill | Ratio |
| --- | --- | ---: | --- | ---: |
| Success | #067647 / #ECFDF3 | 5.40:1 | #75E0A7 / rgba(18,183,106,0.16) | 7.49:1 |
| Warning | #93370D / #FEF0C7 | 6.62:1 | #FEC84B / rgba(245,181,68,0.16) | 7.30:1 |
| Danger | #B42318 / #FEF3F2 | 6.05:1 | #FDA29B / rgba(240,68,56,0.16) | 7.00:1 |
| Info | #175CD3 / #EFF8FF | 5.57:1 | #B2DDFF / rgba(46,144,250,0.16) | 8.70:1 |
| Neutral | #667085 / #F8FAFC | 4.75:1 | #98A2B3 / #17233A | 6.09:1 |

## Remaining outside this scope

- DashboardPage still has blue/violet ministry fallback colors.
- CommunicationsPage, CheckInPage and BibleStudyPage still have literal ministry fallback colors; BibleStudyPage also has green/gray status literals.
- DutyPage retains configurable team color presets and a violet fallback.
- LoginPage retains a literal navy photograph-overlay gradient.
- AttendanceLogPage's PDF/export colors remain separate from screen theme tokens.
- Legacy Tailwind palette variables and other page-specific components remain for compatibility. Their complete contrast/accessibility audit was outside this two-page polish.
- The existing production build reports large JavaScript chunks. This styling pass does not change bundling or data loading.

## Validation

Validation uses mocked API responses; no live data edits or emails are performed. Production TypeScript/Vite build succeeds. Light/dark desktop/mobile checks cover badge text contrast, theme toggle persistence, keyboard menu/confirmation handling, responsive boundaries, independent inspector scrolling, sidebar selection/alignment and designated-ministry clearance. Broader page/header/skeleton and help regressions are also checked.
