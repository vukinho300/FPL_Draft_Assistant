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
Status: COMPLETE

Implemented:
- project-owned Supabase browser client boundary;
- safe public environment contract;
- repository-pinned Supabase CLI/local workflow;
- migration-first Supabase project structure;
- Auth/Postgres/RLS/Storage local foundation;
- no premature application feature schema.

## League accounts
### A1 — Six accounts + RLS
Status: COMPLETE

Implemented:
- six league account/team identities;
- auth-user to league-account mapping foundation;
- constrained `MEMBER` / `LEAGUE_OWNER` roles;
- Jakin Goff as the single `LEAGUE_OWNER`;
- product-facing title **Commissioner**;
- RLS/private authorization helpers preventing member privilege escalation;
- secure provisioning workflow without committed passwords;
- generated database types and local RLS verification.

### A1.5 — Persistent Session / Automatic Login
Status: COMPLETE

Implemented:
- one project-owned Supabase Auth session service over the shared browser client;
- startup states `INITIALIZING`, `AUTHENTICATED`, `UNAUTHENTICATED`;
- Supabase-managed persistent browser sessions and automatic token refresh;
- successful login can be restored across refresh/reopen while the session remains valid;
- no project password storage or parallel custom auth storage;
- explicit sign-out clears authenticated state;
- shared team-name to internal Auth identity resolver;
- no A2 UI/auth gate pulled forward.

### A2 — Account-aware shell
Status: CURRENT

Goal:
Connect the completed A1/A1.5 identity/session foundations to the actual application shell.

Required behavior:
- initialize/restore Supabase session before rendering auth-dependent UI;
- while auth is `INITIALIZING`, show a neutral loading/splash state rather than a false login screen;
- unauthenticated users see the team-name + password login experience;
- authenticated users enter the league application automatically;
- authenticated Supabase user resolves to exactly one league account/team;
- My Team resolves to the logged-in team;
- member/Commissioner UI derives from real account role/data;
- Jakin Goff displays **Commissioner** while backend authorization remains `LEAGUE_OWNER`;
- expose an explicit logout action;
- valid persisted sessions survive page refresh and browser reopen without asking for the password again;
- logout prevents automatic re-entry until the user signs in again;
- desktop/mobile consume the same authenticated account/session model.

Security rules:
- do not store passwords;
- do not hardcode Commissioner authority in React;
- do not trust role strings from localStorage or other client-only persistence;
- backend/RLS remains the permission boundary;
- do not create a second Supabase client or duplicate auth-session lifecycle.

Out of scope for A2:
- Gameweek lineup persistence/locking;
- standings or league-ID integration;
- team avatar/profile feature;
- Trading Block/trades;
- scoring;
- player photos.

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
- Authentication sessions may persist per browser/device, but passwords must never be stored by project code.
- Auth-dependent UI must wait for session restoration before deciding authenticated vs unauthenticated.
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