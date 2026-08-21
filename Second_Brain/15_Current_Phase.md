# Current Phase

## F2 — Desktop + Mobile Responsive Shell
Status: CURRENT — FINAL MOBILE PRESENTATION PASS REMAINS

## Dependency state
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: CURRENT
- F3 — Supabase Foundation: NEXT

## Goal
Preserve the rich desktop Kile N Others dashboard while intentionally supporting phones in the same React application.

Desktop and mobile are first-class presentations of one product. They share domain logic, normalized data, controller/application state and business rules.

F2 is presentation/responsive work only.

## Current implementation state
Merged F2 work now includes:
- dedicated desktop and mobile presentation trees over one shared controller;
- React viewport-based presentation selection with one presentation mounted at a time;
- desktop presentation preserved;
- global phone overflow defect from desktop body minimum width removed;
- real mobile League, My Team, Teams and Matchday presentation components;
- real mobile bottom navigation;
- mobile squad presentation independent of the desktop football pitch;
- focused tests for navigation, presentation selection, state continuity and player loading.

F2 is therefore implemented in part and must no longer be described as unimplemented.

## Current seven main views
- League
- My Team
- Teams
- Matchday
- Players
- Transactions
- Draft Archive

All seven must remain intentionally usable on both desktop and mobile.

## Final F2 product direction
### Mobile navigation
Primary navigation is:
1. League
2. My Team
3. Teams
4. More

More contains:
- Players
- Matchday
- Transactions
- Draft Archive

The bottom navigation should be redesigned toward the approved polished sports-app pattern:
- floating and rounded;
- safe spacing from viewport edges and iPhone safe area;
- no clipped bottom corners;
- icons + labels where appropriate;
- clear animated active state;
- restrained transitions with `prefers-reduced-motion` support;
- normal touch target sizing.

### Mobile viewport contract
At representative phone widths (especially approximately 360px, 390px and 430px):
- no document-level horizontal scrolling;
- no primary-content sideways scrollers;
- normal use requires vertical scrolling only;
- no zooming is required to read or operate the app;
- keep accessible browser zoom available;
- content must genuinely fit rather than being hidden/scaled.

### League mobile page
The League page should become Gameweek-first.

Main heading:
- `Kile N Others`, not simply `League`.

Remove from primary League-home presentation:
- Open Draft Archive CTA;
- manager-count card;
- complete-squad card;
- official-draft-count card;
- roster-completeness section;
- draft-history activity feed.

Priority areas:
- current Gameweek context;
- My Gameweek Points;
- league standings;
- important verified football/Gameweek events;
- recent transactions lower on the page.

Where real data is not yet connected, use intentional truthful unavailable states. F2 must not fabricate standings, scores or live events.

### My Team / Teams visual direction
The long-term target is a football-pitch Gameweek lineup experience inspired by the supplied Fantacalcio reference, but persistent lineup behavior does not belong in F2.

During F2:
- do not fake or persist a submitted XI locally;
- do not imply the current 15-man role grouping is an official Gameweek lineup;
- a reusable non-authoritative pitch visual foundation may be introduced only if it can be done without creating false lineup semantics or throwaway local persistence.

Teams mobile cleanup should:
- keep a compact useful manager selector;
- remove the explanatory `Choose a manager` content card;
- remove 15/15 and GK/DEF/MID/FWD roster-capacity counters from the Gameweek-oriented presentation.

### Remaining mobile pages
Before F2 closes, implement intentional mobile presentations for:
- Players;
- Transactions;
- Draft Archive.

No primary page should fall back to a desktop table that requires sideways scrolling.

## Architecture constraints
- One application, not separate desktop/mobile applications.
- No duplicate desktop/mobile business logic.
- Reuse shared domain logic and normalized data.
- Presentation-specific components are allowed where layout genuinely differs.
- Do not introduce Supabase, authentication, database persistence or RLS in F2.
- Do not implement authoritative lineup persistence in F2.
- Do not guess player-photo/CDN mappings in F2.
- Do not alter immutable official-draft history.
- Do not rewrite unrelated domain architecture.

## Deferred approved requirements after F2
The following product requirements are approved but intentionally belong to later roadmap steps:
- shared persistent mobile/desktop Gameweek lineup entity;
- starter/bench editing and submission;
- formation derived from starter positions;
- ordered bench GK + 1 + 2 + 3;
- automatic display fallback when a manager did not submit;
- zero project-calculated lineup points for the unsubmitted fallback;
- verified Premier League player photos;
- real standings/current Gameweek/My Gameweek points;
- verified goals/assists/penalty saves/hat-trick event feed.

See `07_League_Rules_Product_Behavior.md`, `11_Decision_Log.md` and `12_Roadmap.md` for the approved downstream rules.

## Acceptance criteria
F2 is complete only when:
- all seven main views are intentionally usable at representative desktop and phone widths;
- desktop sidebar and rich desktop experience remain intact;
- mobile uses the approved primary navigation order and polished floating navigation treatment;
- mobile League page uses the approved Gameweek-first information hierarchy;
- Teams removes roster-administration clutter from the mobile presentation;
- Players, Transactions and Draft Archive have intentional mobile presentations;
- primary controls are touch-friendly;
- major grids/cards reflow without clipping;
- there is no unintended document-level horizontal overflow;
- normal phone use does not require zooming;
- no duplicate business logic is introduced for mobile;
- no Supabase/auth/database work is mixed into F2;
- automated checks pass;
- rendered desktop/mobile review passes;
- real-iPhone review across all seven views passes.

## Verification direction
For meaningful F2 pre-merge verification, normally run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

`npm run verify:fpl-live` is not required unless F2 unexpectedly changes the live FPL boundary.

Rendered/manual verification must cover approximately:
- 360px
- 390px
- 430px
- 1440px desktop

At mobile widths, verify each completed view against:
`document.documentElement.scrollWidth === document.documentElement.clientWidth`

Real-device iPhone review is required before F2 is declared complete.

## Codex workflow
For repository-heavy implementation work, Codex should inspect the current implementation, plan the technical solution and implement it. ChatGPT provides product constraints/acceptance criteria and independently verifies repository changes rather than prescribing unnecessary low-level code structure.

## Next phase
### F3 — Supabase Foundation

F3 begins only after the final F2 presentation pass is merged and all-seven-view desktop/mobile verification passes.
