# Phase A–B review checkpoint

Phase A foundation and Phase B Members & Families are ready for review. Work pauses here at the user's requested checkpoint. New changes for Topics (C), Bible Study Groups (D), and the four Bible Study modals (E) are deferred; prior completed styling is retained.

## Audit

ThemeContext applies the root dark class and data-theme, with dpc_theme_mode persisted in localStorage. Semantic colors live in design-tokens.css. The legacy utility palette lives in index.css and tailwind.config.js.

Shared PageHeader, StatCard, Button, Badge, ModalPanel and DialogPanel live in components/common. Sidebar/NavBar live in components/layout. MembersPage owns the table and member dialogs; MemberRowActions owns the existing kebab menu. CurriculumPage owns book cards and the inspector. BibleStudyPage owns group cards and Group Details. SessionHistoryModal owns sessions. GroupHistoryModal renders both per-group transition history and the all-church merge log.

ModalPanel currently separates headers/footers from scrolling content. The new ModalShell adds a single plain header, sizes (480/670/770px), an accessible X control, scroll fade and action footer, and reuses DialogPanel/useDialogFocus for focus trapping, Escape, focus restoration and nested body scroll locking. Outside dismissal is disabled when its caller supplies hasUnsavedChanges.

The complete remaining source scan is in [design-audit-color-inventory.txt](</C:/Users/MARK ANGELO/DPC-ManagementSystem/docs/design-audit-color-inventory.txt>). It lists literal colors and cream/purple utility occurrences, excluding central token definitions. CSS-overridden legacy classes are identified as review candidates rather than automatically treated as rendered failures.

## Changes in this phase

| File | Change |
| --- | --- |
| client/src/design-tokens.css | Changed primary-button text to the requested #3B2300; retained exact light/dark surface and status tokens. |
| client/src/components/common/Badge.tsx | Added an optional count so zero-valued badges automatically use the neutral variant. |
| client/src/hooks/useDialogFocus.ts | Added nested-dialog scroll locking and restoration of previous body/root overflow styles. |
| client/src/components/common/ModalShell.tsx | Added a reusable plain-header modal shell with sizes, labels, close control, action footer and safe outside dismissal. |
| client/src/components/common/modal-shell.css | Added token-based surfaces, scroll fade, fixed header/footer, 36px controls and reduced-motion styling. |
| client/src/utils/displayDate.ts | Added an en-PH “Oct 9, 2026” display formatter that preserves date-only calendar days. Wiring to later Bible Study screens waits for their phases. |
| client/src/features/members/components/MemberDeleteDialog.tsx | Reused the small shared modal shell for member deletion confirmation. |
| client/src/pages/MembersPage.tsx | Kept handlers/queries, follow-up filter and kebab actions; replaced cream/purple styling, applied semantic styling to member dialog portals, raised 11px labels to 12px, used warning tokens for Warning, and reused shared delete buttons. |
| client/src/pages/members.css | Added neutral zero-count follow-up state and tokenized delete notice styling. |
| client/src/components/layout/Sidebar.tsx | Replaced the remaining cream footer panel with surface-2; retained the single navy/gold active state and reserved chevron space. |
| tests/e2e/members-polish.spec.ts | Added zero-count, gold text, scroll lock/restoration, updated focus cycle, outside cancellation and persisted-theme checks. |
| tests/e2e/display-date.spec.ts | Verified calendar-day display formatting and empty/invalid fallbacks. |
| docs/design-audit-color-inventory.txt | Saved the source color inventory for later phases. |
| docs/design-phase-ab-review.md | Saved this phase report and review checkpoint. |

Members retains Details/Edit plus a keyboard-accessible kebab menu. Delete stays in that menu and opens confirmation; no test submits deletion. The follow-up chip explicitly counts loaded members “on this page,” applies the existing Action Required filter, and becomes neutral at zero.

## Contrast

Dark translucent badge fills are composited over surface-2 (#17233A); this is the conservative case for the two dark surfaces. All status text pairs exceed AA 4.5:1.

| Variant | Light text / fill | Ratio | Dark text / fill | Ratio |
| --- | --- | ---: | --- | ---: |
| Success | #067647 / #ECFDF3 | 5.40:1 | #75E0A7 / rgba(18,183,106,.16) | 7.49:1 |
| Warning | #93370D / #FEF0C7 | 6.62:1 | #FEC84B / rgba(245,181,68,.16) | 7.30:1 |
| Danger | #B42318 / #FEF3F2 | 6.05:1 | #FDA29B / rgba(240,68,56,.16) | 7.00:1 |
| Info | #175CD3 / #EFF8FF | 5.57:1 | #B2DDFF / rgba(46,144,250,.16) | 8.70:1 |
| Neutral | #667085 / #F8FAFC | 4.75:1 | #98A2B3 / #17233A | 6.09:1 |

## Transition-log bug: confirmed, fix deferred to E4

GroupHistoryModal currently renders the value t.reason inside a strong element followed by a colon, then renders t.notes. Therefore a reason of “Group restructuring” with no notes becomes “Group restructuring:” instead of “Reason: Group restructuring”. The value exists; the renderer mistakenly treats it as the label. Phase E4 will render an explicit Reason label and suppress an empty reason row without changing stored data or API logic.

## Pending and outside scope

- Phase C will apply zero-value badges and the shared date/modal foundation where relevant to Topics.
- Phase D will address the Groups page action hierarchy, filters, flattened cards, confirmation presentation and equal-height footers.
- Phase E will replace all four Bible Study modal shells and their cream/purple styling, standardize displayed dates, and fix the transition reason label.
- Group Details and transition forms still have mixed or missing dialog semantics; this is documented rather than prematurely migrating them before review.
- Auxiliary Members dialogs still use the legacy ModalPanel; their colors are updated, but this pass migrates only member deletion to the new shell. Their complete dialog/accessibility migration remains pending.
- Existing data strings “asddfg”, “sdfdfg” and “DiscipleShip” were not found hardcoded in client/src, server/src or tests/e2e. Group/book names in the screenshots are data displayed through group.name/topic.title/curriculum fields. No names or capitalization were changed.
- Dashboard, attendance, communication, duty and login screens retain legacy color fallbacks or decorative gradients; see the inventory. Shared ConfirmationModal outside the new shell still uses legacy variant styling and requires a separate migration.
- The production build still reports large bundles. No dependency or bundling changes were introduced.

## Validation

Production TypeScript/Vite build passes. Ten mocked checks cover Members light/dark desktop/mobile, zero follow-up counts, badge contrast, keyboard menu/focus cycles, delete cancellation, outside dismissal, body overflow restoration, table/control scrolling and date formatting. Persisted theme switching is separately verified in the updated Members checks. No live API writes or emails are performed.
