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
- floating rounded mobile navigation with `League / My Team / Teams / More`;
- all seven main views usable on mobile and desktop;
- Gameweek-first League hierarchy;
- no duplicate desktop/mobile business logic.

### P5A — Players filtering/sorting
Status: COMPLETE

Implemented:
- full verified player names;
- search by player/owner;
- position and ownership filtering;
- Free Agent state derived from current ownership;
- sort by Official FPL Draft Rank;
- sort by Form;
- sort by Total Points;
- sort by MVP Consensus;
- Draft Model Rank preserved as project evidence but removed as a primary Players-page sort;
- compact Form Leaders and Total Points Leaders;
- shared desktop/mobile selector and ordering;
- live official Form and Total Points normalized at the FPL adapter boundary.

### F3 — Supabase foundation
Status: CURRENT

Goal:
Introduce the minimum Supabase Auth/Postgres/RLS/Storage foundation, repository migrations and safe environment/configuration boundaries. Do not mix broad league features into F3.

F3 must prepare for the later account and lineup authorization model without implementing the full lineup feature yet.

## League accounts
### A1 — Six accounts + RLS
Status: NEXT AFTER F3

- Pre-create six accounts.
- Team-name login UX.
- MEMBER / LEAGUE_OWNER authorization.
- Jakin Goff uses unique admin credentials.
- Jakin Goff's product-facing title is **Commissioner** while backend role remains `LEAGUE_OWNER`.
- Backend/RLS policies, not UI hiding, enforce privileged operations.

### A2 — Account-aware shell
- Session identity available throughout app.
- My Team resolves to logged-in team.
- Commissioner/member UI derived from real permissions.

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
- Logged-in manager's current Gameweek points where verified.

### G3 — Gameweek lineup domain + persistence
Build the authoritative shared lineup entity used by both mobile and desktop.

Required behavior:
- draft/edit lineup without submitting;
- exactly 11 starters;
- valid FPL starting-XI positional constraints;
- formation derived from starter positions;
- one substitute goalkeeper;
- ordered outfield bench positions 1, 2 and 3;
- persistent per-manager/per-Gameweek state in the shared database;
- explicit draft/submitted/missing state;
- submitted lineup retains enough history to reconstruct that Gameweek;
- no authoritative localStorage/device-specific lineup state.

Lineup authorization and lock:
- before the verified Gameweek start/deadline, each MEMBER may create/edit/submit only their own lineup;
- members may never edit another manager's lineup;
- once the Gameweek starts, MEMBER lineup writes for that Gameweek are locked;
- after kickoff, only Jakin Goff / `LEAGUE_OWNER` / Commissioner may insert, edit or replace a lineup for itself or any manager;
- commissioner post-start writes are privileged administrative actions and must be backend/RLS enforced and auditable;
- the lock uses verified backend/server Gameweek timing, not only client time.

Missing submission:
- never reuse the previous Gameweek lineup;
- submission remains missing/unsubmitted;
- Teams may show a clearly labeled display-only auto-valid fallback;
- fallback is not official and gets zero project-calculated lineup points;
- Commissioner may later insert an authoritative lineup as an audited admin action.

### G4 — Account-specific My Team + Teams Gameweek presentation
- football-pitch XI positioned by derived formation;
- shared lineup renderer/model for My Team and Teams;
- members edit only their own pre-deadline lineup;
- Teams normally shows other managers read-only;
- Commissioner may receive explicit admin lineup controls according to the G3 lock rule;
- separate ordered bench below the pitch;
- verified player photos when P1/P2 are available, otherwise neutral fallback.

### G5 — Gameweek scoring
- Verified official total where available.
- Project-calculated total only for a valid submitted project lineup where justified.
- Automatically generated fallback receives zero project-calculated points.
- Explicit source/provenance.

### G5A — Important Gameweek event feed
Verified significant events only: goals, assists, goalkeeper penalty saves, hat tricks and other supported scoring events.

### G6 — Commissioner score corrections
- LEAGUE_OWNER/Commissioner-only audited correction flow.

## Player improvements
### P1 — Premier League photo identity research
Prove mapping/image contract before production use.

### P2 — Player photos
Use verified official Premier League mapping.

### P3 — Stats/status adapter
Add verified minutes, starts, availability/news and recent usage inputs not already exposed by P5A.

### P4 — Usage classification
Project-derived starter/substitute/reduced-minutes labels; insufficient evidence -> Unknown.

### P5B — Enriched Players filtering/sorting
Build only on verified P3/P4 fields. P5A already provides Official Rank, Form, Total Points and MVP sorting.

## Transactions / trading
### T1 — Trading Block
Persistent user-owned list/unlist flow with RLS.

### T2 — Trade proposals
Send/respond/cancel proposals. Participant/admin visibility. No automatic roster mutation on acceptance.

### T3 — Player comparison
Shared player data used to compare trade value.

### T4 — Real FPL transaction reconciliation
Observe verified FPL history/ownership and explicitly reconcile before marking project records PROCESSED.

## Later enhancements
### L1 — Start/bench assistant
### L2 — Waiver/free-agent assistant
### L3 — Trade-value model
### L4 — Notifications
### L5 — Manager/season analytics

## Dependency rules
- Mobile and desktop are presentation layers over one shared domain/data/backend model.
- Persistent mutable data must not have device-specific authoritative copies.
- Authorization-sensitive writes must be enforced in backend/RLS policies.
- Player display names use the full verified available name.
- Free Agent/Owned state derives from current roster ownership.
- Formation/lineup legality belongs in shared domain logic.
- Member lineup writes lock when the verified Gameweek starts; only the Commissioner can perform post-start lineup administration.
- Commissioner post-start lineup changes must be auditable.
- Automatically generated fallback lineups remain distinct from submitted lineups and are not eligible for project-calculated lineup points.
- Do not build project scoring before lineup and player-Gameweek contracts exist.
- Do not automate official FPL writes before read/reconciliation behavior is proven.
- Do not guess Premier League image URLs or identity mappings.
- Do not let a live feed overwrite immutable draft-day evidence.