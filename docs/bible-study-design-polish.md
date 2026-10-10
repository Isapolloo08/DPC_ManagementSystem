# Bible Study design polish — October 10, 2026

Scope: Bible Study & Discipleship Groups and its Group Details, Session History, Group Transition History, and All Church Transitions & Merges Log dialogs. Routes, API calls, persistence, permissions and submit handlers were preserved. No dependencies were added. Sidebar and navbar were excluded.

## Audit and reused foundation

- `client/src/design-tokens.css`: semantic light/dark surfaces, text, accent, borders and five status token sets.
- `client/src/components/common/Button.tsx`, `Badge.tsx`, and their CSS: shared controls and soft status badges. A zero count uses neutral styling.
- `client/src/components/common/ModalShell.tsx`, `DialogPanel.tsx`, `ModalPanel.tsx`, `modal-shell.css`, `hooks/useDialogFocus.ts`: shared plain dialog header, fixed header/footer, scrolling body and fade, keyboard focus, dismissal and scroll lock.
- `client/src/utils/displayDate.ts`: shared en-PH display date formatter; stored dates and native date input values are untouched.
- Group cards and Group Details live in `client/src/pages/BibleStudyPage.tsx`; the other three dialogs live in the two biblestudy history components.
- Bypasses found included cream `bg-ivory-light` fields/filter pills, violet/purple merge indicators, indigo/amber status/action utilities, hardcoded ministry color fallbacks and the Session History navy/gold banner. These were removed from the targeted layout or mapped to semantic surfaces/text. Status colors use the shared Badge component.

## Changelog for this round

| File | Change |
| --- | --- |
| `client/src/pages/BibleStudyPage.tsx` | Gold primary header action; secondary actions menu; category dropdown and conditional clear filters; flat equal-height cards, one-line notice tooltip, neutral action row and gold roster action; shared Group Details shell and simpler footer; clarify roster capacity, add UI-only roster search, format displayed dates. Existing completion/archive confirmation forms and their submit handlers remain in place. |
| `client/src/components/biblestudy/SessionHistoryModal.tsx` | Shared plain shell, compact subtitle, connected timeline, neutral zero-count badges, small empty-note line, pagination only when needed, header X dismissal, shared dates and refresh button. Existing fetch, filtering and pagination logic retained. |
| `client/src/components/biblestudy/GroupHistoryModal.tsx` | Shared shells for single-group history and church-wide log; preserve Leadership Record; success Active Group badge; neutral source rows and info merge badge; accessible keyboard activation, neutral Inspect action, shared dates; correct reason/notes labels. |
| `client/src/components/biblestudy/study-design.css` | Scoped semantic page/card/modal styling; neutral legacy utilities in these screens, readable captions, responsive action layouts, roster/body fade, timeline, gold focus, 150ms background/color transitions and reduced-motion support. |
| `client/src/components/common/ActionMenu.tsx` | Accessible portalled actions menu with labels, arrow/Home/End navigation, Escape dismissal and focus return. Reposition on scroll/resize so browser auto-scrolling a trigger does not silently close the menu. |
| `client/src/components/common/action-menu.css` | Semantic menu surfaces, neutral items, destructive archive styling, gold keyboard focus, 40px menu targets and reduced-motion support. |
| `client/src/hooks/useDialogFocus.ts` | Let a portalled action menu handle its own Escape/Tab before the parent dialog, so closing the menu retains the dialog. |
| `tests/e2e/session-history.spec.ts` | Update dismissal expectation to the shared header X; retain existing mocked error, retry, filter, details and mobile checks. |
| `tests/e2e/study-design-polish.spec.ts` | Mocked light/dark coverage for all four dialogs, mobile sizing, shared dates, filters, equal-height cards, capacity/search, nested focus return, menu keyboard behavior, body lock, outside dismissal, theme switching, reduced motion and badge contrast. No real API mutations. |
| `docs/bible-study-design-polish.md` | Audit, changelog, bug explanation, contrast values, validation and remaining scope. |

## Root cause of “Group restructuring:”

The church-wide transition renderer displayed the reason value in a bold label followed by a colon, then displayed the notes value. With `reason = "Group restructuring"` and empty notes, the result was `Group restructuring:`. The data was present; its value was mistakenly used as the label. It now renders `Reason: Group restructuring` and, independently, `Notes: …` when notes exist. Blank/whitespace reason and notes rows are hidden.

## Contrast

Text-to-fill ratios, using WCAG relative luminance. Dark translucent fills are composited over `--surface-2` (#17233A), the lighter supported card background, to give conservative values. All pass 4.5:1; zero-count badges use neutral.

| Status | Light | Dark |
| --- | ---: | ---: |
| Success | 5.40:1 | 7.49:1 |
| Ongoing / warning | 6.62:1 | 7.30:1 |
| Danger | 6.05:1 | 7.00:1 |
| Info | 5.57:1 | 8.70:1 |
| Neutral | 4.75:1 | 6.09:1 |

## Validation

Client TypeScript and Vite production build passed. Five targeted Playwright tests pass: shared date formatting, two Session History tests, and two page/four-dialog tests. API requests are mocked and checked for zero mutations. Screenshots were reviewed in light/dark and at 390px width. Theme switching updates the existing tokens; reduced motion suppresses dialog animation. Vite still reports its existing large bundle warning.

## Found but outside this round

- `BibleStudyPage.tsx` still has legacy create/edit, archive, complete, restore, quick progress and completed-group selector forms using `ModalPanel` directly. They retain inconsistent styles and lack the full shared dialog semantics/focus handling. Archive/Complete remain confirmation forms; selecting the menu action does not submit them.
- `GroupTransitionModal.tsx` still uses cream utilities and legacy styling. It already has a five-step flow with a review/confirmation step, so submission logic was not changed.
- `pages/leader/LeaderBibleStudy.tsx` and other pages still have separate legacy forms/colors. They were not included in this four-dialog polish.
- Sidebar/navbar styling and accessibility findings remain part of their separate review; this round did not edit either file.
