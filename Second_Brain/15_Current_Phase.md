# Current Phase

## F2 — Desktop + Mobile Responsive Shell
Status: CURRENT — NOT YET IMPLEMENTED

## Dependency state
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: CURRENT
- F3 — Supabase Foundation: NEXT

## Goal
Preserve the existing rich desktop Kile N Others dashboard while intentionally supporting phone layouts in the same React application.

Desktop and mobile are first-class presentations of one product. They must share domain logic, normalized data, application state and business rules.

F2 is presentation/responsive work only.

## Current seven main views
- League
- My Team
- Teams
- Matchday
- Players
- Transactions
- Draft Archive

All seven must remain intentionally usable on both desktop and mobile.

## Expected desktop behavior
- Preserve the existing sidebar.
- Preserve rich wide-screen layouts.
- Preserve useful tables and comparisons.
- Preserve spacious pitch/squad presentations.
- Do not simplify desktop merely to make mobile easier.

## Expected mobile behavior
- Provide compact navigation that does not depend on the desktop sidebar.
- Use touch-friendly controls.
- Reflow grids/cards intentionally.
- Keep pitch/squad representations readable at phone widths.
- Give wide tables explicit compact or horizontal-scroll treatment.
- Prevent document-level horizontal overflow.
- Do not remove important features solely because the viewport is mobile.

## Architecture constraints
- One application, not separate desktop/mobile applications.
- No duplicate desktop/mobile business logic.
- Reuse shared domain logic and normalized data.
- Prefer responsive shared components.
- Use presentation-specific components only where the layout genuinely requires it.
- Do not introduce Supabase, authentication, database persistence or RLS in F2.
- Do not alter immutable official-draft history.
- Do not rewrite unrelated domain architecture.

## Acceptance criteria
- All seven main views are intentionally usable at representative desktop and phone widths.
- Desktop sidebar and existing rich desktop experience remain intact.
- Mobile has intentional compact navigation.
- Primary controls are touch-friendly.
- Major grids/cards reflow without clipping.
- Teams/My Team pitch or squad presentations remain readable.
- Wide tables have intentional narrow-screen handling.
- There is no unintended document-level horizontal overflow.
- No duplicate business logic is introduced for mobile.
- No Supabase/auth/database work is mixed into the phase.
- Existing application behavior and project rules remain intact.

## Verification direction
During implementation, use focused tests and rendered checks for the specific responsive behavior being changed.

For meaningful F2 pre-merge verification, normally run:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

`npm run verify:fpl-live` is not required unless F2 unexpectedly changes the live FPL boundary.

Rendered/manual verification must cover representative desktop and narrow phone-sized viewports.

## Codex read scope
Codex should initially read only:

- `Second_Brain/00_HOME.md`
- `Second_Brain/03_Current_Architecture.md`
- `Second_Brain/09_Testing_Deployment.md`
- `Second_Brain/15_Current_Phase.md`

Then inspect only the frontend files directly relevant to the first narrow F2 implementation step.

Do not perform broad repository rediscovery unless a concrete issue requires it.

## Implementation state
No F2 implementation branch or implementation PR exists yet.

Do not treat this phase as complete until its required responsive behavior has been implemented, independently verified and merged.

## Next phase
### F3 — Supabase Foundation

F3 begins only after F2 is complete and its verified state has been reconciled into the Second Brain.