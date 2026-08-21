# Current Phase

## P5A — Basic Players Filtering/Sorting
Status: CURRENT

## Dependency state
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Basic Players Filtering/Sorting: CURRENT
- F3 — Supabase Foundation: NEXT AFTER P5A

## Why P5A is now
The responsive/mobile foundation is complete. Before beginning the heavier database phase, the existing Players directory can be made materially more useful using data that already exists in the repository and current normalized FPL boundary.

This is a deliberately small product step, not a replacement for later P3/P4 enriched player data.

## Goal
Improve Players filtering/sorting on both desktop and mobile while preserving one shared directory model/state.

Required capabilities:
- display the player's full available verified name, not surname-only and not first-name-only;
- existing player/owner search;
- position filter: ALL / GK / DEF / MID / FWD;
- ownership filter: ALL / FREE AGENTS / OWNED;
- sort by Official Draft rank;
- sort by Draft MVP rank;
- sort by model rank where the current trusted player-directory data exposes it reliably;
- deterministic behavior when a selected rank is missing;
- same filter/sort result on desktop and mobile.

Example target workflow:
`GK -> Free Agents -> Draft MVP rank`.

## Player-name rule
Use the full available name from verified/current normalized player identity data.

Do not:
- display surname-only when the normalized model contains the player's full name;
- display first-name-only;
- manually guess or reconstruct missing names from external assumptions.

If the current player model does not expose a true full-name field, Codex should inspect the verified upstream fields and choose the safest project-owned normalization change needed to expose one without weakening identity correctness.

## Ownership rule
Free Agent / Owned status must be derived from the current ownership directory, which itself is derived from:

```text
immutable official draft
+
PROCESSED post-draft transactions
=
current ownership
```

Never hardcode a Free Agent list.

If a future PROCESSED transaction changes ownership, the Players page must naturally reflect that new state.

## Ranking rule
Only sort on ranking fields actually present in the trusted project model.

Current intended ranking options:
- Official Draft rank;
- Draft MVP rank;
- model rank where current normalized/domain data exposes it reliably.

Do not invent missing ranks.

Codex should inspect actual repository fields before deciding exact null/missing ordering and default sort direction. The behavior must be deterministic and covered by tests.

## Desktop/mobile architecture
F2 established two presentation trees over one shared controller/model.

P5A must preserve that architecture:
- filtering/sorting state lives in shared model/controller logic;
- desktop and mobile consume the same filtered/sorted result;
- presentation controls may differ visually where appropriate;
- do not implement two independent filtering engines.

## Out of scope
Do not add in P5A:
- Supabase/database work;
- authentication;
- player photos;
- points/form filters;
- minutes/starts filters;
- availability/injury filters;
- usage classification;
- fixtures;
- new model training;
- new external data sources;
- trade/waiver behavior.

Those belong to later steps, especially P3/P4/P5B and F3 onward.

## P5B later
After verified P3/P4 enrichment exists, P5B may add useful controls such as:
- total points;
- recent points/form;
- minutes;
- starts;
- availability/injury;
- usage classification;
- club;
- other verified player-value evidence.

Never add a filter before its underlying data contract exists.

## Acceptance criteria
P5A is complete only when:
- Players displays full available verified player names;
- ownership filter supports All / Free Agents / Owned;
- position and ownership filters compose correctly;
- Official / MVP / supported model sorting works;
- search composes with position + ownership + sort;
- missing ranks are handled predictably;
- current ownership determines Free Agent state;
- desktop and mobile show consistent result ordering;
- mobile controls remain readable and require no horizontal scrolling;
- existing F2 mobile navigation/layout remains intact;
- automated tests cover shared filtering/sorting behavior and full-name display;
- typecheck/test/build/lint pass.

## Verification direction
Run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

`npm run verify:fpl-live` is not required unless the implementation unexpectedly changes the live FPL boundary.

Rendered/manual verification should cover Players on:
- mobile around 390px;
- desktop around 1440px.

## Codex workflow
This is repository-heavy enough for Codex-led planning + implementation.

Codex should inspect the actual current player-directory model and presentation before choosing:
- player-name normalization path;
- filter/sort state shape;
- exact controls;
- comparator/null ordering;
- where shared logic belongs;
- smallest test changes.

ChatGPT provides product constraints and verifies the PR rather than prescribing unnecessary implementation details.

## Next phase
### F3 — Supabase Foundation

F3 begins after P5A is merged, verified and reconciled.