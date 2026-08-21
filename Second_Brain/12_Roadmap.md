# Roadmap

Build in small dependency-ordered phases. Do not collapse these into one large Codex task.

## Must-have foundation
### F0 — Second Brain scaffold
Status: COMPLETE

### F1 — Vercel deployment
Status: COMPLETE

### F2 — Desktop + mobile responsive shell
Status: COMPLETE

Result:
- separate desktop/mobile presentation trees over one shared controller;
- preserved desktop dashboard;
- floating rounded mobile navigation with primary order `League / My Team / Teams / More`;
- all seven main views intentionally usable on mobile and desktop;
- Gameweek-first mobile League hierarchy;
- intentional mobile Players, Transactions and Draft Archive views;
- mobile width model no longer depends on desktop minimum widths;
- no duplicate desktop/mobile business logic;
- no Supabase/auth/database work mixed into F2.

### P5A — Basic Players filtering/sorting
Status: CURRENT

Goal:
Make the existing Players directory immediately useful with the data already present in the project, before beginning the heavier backend phase.

Required controls/behavior:
- display the player's full available name, not surname-only and not first-name-only;
- search by player/owner;
- position: ALL / GK / DEF / MID / FWD;
- ownership: ALL / FREE AGENTS / OWNED;
- sort by Official Draft rank;
- sort by Draft MVP rank;
- sort by model rank where the current trusted directory model exposes it;
- deterministic handling of missing rank values;
- same filtering/sorting behavior on desktop and mobile through shared state/logic.

Example supported use:
`GK -> Free Agents -> Draft MVP rank`.

Rules:
- player names must come from verified/current normalized player identity data; do not guess or manually reconstruct missing names;
- Free Agent status is derived from current ownership after PROCESSED transactions, never hardcoded;
- do not pull in P3/P4 stats/status fields yet;
- do not invent rank values;
- do not create separate mobile/desktop filter logic.

### F3 — Supabase foundation
Status: NEXT AFTER P5A

Goal:
Introduce the minimum database/storage/auth infrastructure and migrations. No broad league features yet.

## League accounts
### A1 — Six accounts + RLS
- Pre-create six accounts.
- Team-name login UX.
- MEMBER / LEAGUE_OWNER authorization.
- Jakin Goff unique admin credentials.

### A2 — Account-aware shell
- Session identity available throughout app.
- My Team resolves to logged-in team.
- Appropriate admin/member UI derived from real permissions.

### A3 — Team profiles + avatars
- Team profile table.
- Avatar upload/update.
- Teams page consumes persistent profiles.

## Team / Gameweek tracking
### G1 — Real FPL Draft league/entry identity
- Obtain real league ID and six entry IDs safely.
- Verify league-specific read schemas.

### G2 — League Gameweek + standings adapter
- Real current Gameweek on League page.
- Real league standings.
- Manager overall/season points through the standings model.
- Logged-in manager's current Gameweek points where the verified source supports it.
- Do not duplicate the same points concept under multiple labels.

### G3 — Gameweek lineup domain + persistence
Build the authoritative shared lineup entity used by both mobile and desktop.

Required behavior:
- draft/edit lineup without submitting;
- exactly 11 starters;
- valid FPL starting-XI positional constraints;
- formation derived from starter positions rather than stored as a cosmetic independent setting;
- one substitute goalkeeper;
- ordered outfield bench positions 1, 2 and 3;
- persistent per-manager/per-Gameweek state in the shared database;
- explicit draft/submitted/missing submission state as appropriate;
- submitted lineup retains enough historical information to reconstruct the Gameweek;
- mobile submission is visible on desktop and desktop submission is visible on mobile;
- no authoritative localStorage/device-specific lineup state.

Missing-submission behavior:
- never reuse the previous Gameweek lineup;
- submission remains missing/unsubmitted;
- a valid automatically selected XI + bench may be generated for display in Teams;
- the fallback must remain distinct from submitted state;
- fallback is not eligible for project-calculated lineup points.

### G4 — Account-specific My Team + Teams Gameweek presentation
Connect the real G3 lineup entity to desktop and mobile.

Target presentation:
- football-pitch starting XI positioned by derived formation;
- shared lineup renderer/model for My Team and Teams;
- My Team gets editing/submission controls only for the authenticated owner;
- Teams shows submitted lineup for other managers without edit controls;
- if no lineup was submitted, Teams may show clearly labeled auto-selected fallback;
- separate ordered bench below the pitch: GK, 1, 2, 3;
- remove roster-capacity clutter from the Gameweek lineup presentation;
- verified player photos when P1/P2 are available, otherwise a neutral fallback silhouette.

### G5 — Gameweek scoring
- Verified official total where available.
- Project-calculated total only for a valid submitted project lineup where justified.
- Automatically generated/unsubmitted fallback lineup receives zero project-calculated lineup points.
- Explicit source/provenance.

### G5A — Important Gameweek event feed
Provide verified significant football events for the League home page when the required player/Gameweek data contract exists.

Examples:
- goals;
- assists;
- goalkeeper penalty saves;
- hat tricks;
- other significant scoring events supported by verified data.

Do not derive or display fabricated event records.

### G6 — Admin score corrections
- League-owner-only audited correction flow.

## Player improvements
### P1 — Premier League photo identity research
Prove the mapping/image contract before production implementation.

Dependency priority update:
This should happen before or alongside final G4 visual integration because the target lineup UI relies strongly on player imagery.

### P2 — Player photos
Use verified official Premier League mapping.

Implement before the final photo-complete G4 experience where practical. Until then, use neutral fallbacks rather than guessed image URLs/IDs.

### P3 — Stats/status adapter
Add verified points, minutes, starts, availability/news, recent usage inputs.

P3/G5 data may also support G5A important event derivation when the verified source contract is sufficient.

### P4 — Usage classification
Project-derived labels such as regular starter/substitute/reduced minutes. Early/insufficient evidence -> Unknown.

### P5B — Enriched Players filtering/sorting
Build on P5A after P3/P4 enrichment exists.

Potential controls when backed by verified data:
- total points;
- recent points/form;
- minutes;
- starts;
- availability/injury;
- usage classification;
- club;
- other verified player-value fields.

Do not expose filters for data that is not actually connected.

## Transactions / trading
### T1 — Trading Block
Persistent user-owned list/unlist flow with RLS.

### T2 — Trade proposals
Send/respond/cancel proposals. Participant/admin visibility. No automatic roster mutation on acceptance.

### T3 — Player comparison
Shared player data used to answer "am I getting a good trade?"

### T4 — Real FPL transaction reconciliation
Observe verified FPL history/ownership and explicitly reconcile before marking project records PROCESSED.

## Later enhancements
### L1 — Start/bench assistant
Requires reliable lineup, fixtures, player status and recent-use data.

### L2 — Waiver/free-agent assistant
Requires reliable ownership/free-agent and player-value data.

### L3 — Trade-value model
Requires shared player projections/evidence and stable transaction foundations.

### L4 — Notifications
Only after useful events/triggers exist.

### L5 — Manager/season analytics
Examples:
- original draft value vs season result;
- best/worst draft selections;
- transaction value added;
- roster evolution;
- long-term league archive.

## Dependency rules
- User-facing features should normally work on both desktop and mobile before they are considered complete.
- Mobile and desktop are presentation layers over one shared domain/data/backend model.
- Persistent mutable data must not have separate device-specific authoritative copies.
- Do not create separate desktop/mobile business logic or duplicate data sources.
- Player display names should use the full verified available player name rather than surname-only/first-name-only shortcuts.
- Free Agent/Owned player state must derive from current roster ownership.
- Formation/lineup legality belongs in shared domain logic, not presentation code.
- Do not build project scoring before lineup and player-GW contracts exist.
- Automatically generated fallback lineups must remain distinguishable from submitted lineups and are not eligible for project-calculated lineup points.
- Do not build trade comparison before shared player enrichment exists.
- Do not automate official FPL writes before read/reconciliation behavior is proven.
- Do not build recommendation AI on invented/unverified player status data.
- Do not guess Premier League image URLs or identity mappings.
- Do not let a later live feed overwrite immutable draft-day evidence.