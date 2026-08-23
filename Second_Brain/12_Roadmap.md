# Roadmap

Build in small dependency-ordered phases. Do not collapse these into one large Codex task.

## Must-have foundation
### F0 — Second Brain scaffold
Status: COMPLETE

### F1 — Vercel deployment
Status: COMPLETE

### F2 — Desktop + mobile responsive shell
Status: COMPLETE

### P5A — Players filtering/sorting
Status: COMPLETE

Implemented:
- full verified player names;
- search by player/owner;
- position and ownership filtering;
- Free Agent state derived from current ownership;
- sort by Official FPL Draft Rank, Form, Total Points, MVP Consensus;
- Draft Model Rank preserved as project evidence but removed as a primary Players-page sort;
- compact Form Leaders and Total Points Leaders;
- shared desktop/mobile selector and ordering;
- live official Form and Total Points normalized at the FPL adapter boundary;
- valid signed official Form / Total Points values accepted after PR #33.

### F3 — Supabase foundation
Status: COMPLETE

Implemented:
- project-owned Supabase browser client boundary;
- safe public environment contract;
- repository-pinned Supabase CLI/local workflow;
- migration-first Supabase project structure;
- Auth/Postgres/RLS/Storage foundation.

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
- secure provisioning workflow without committed passwords.

Hosted production state is established in KNO (`asrrkwyqerfkynhjypov`) with six rows, one owner, five members, RLS enabled, public signup disabled, and six private Auth users provisioned.

### A1.5 — Persistent Session / Automatic Login
Status: COMPLETE

Implemented:
- one project-owned Supabase Auth session service over the shared browser client;
- startup states `INITIALIZING`, `AUTHENTICATED`, `UNAUTHENTICATED`;
- Supabase-managed persistent browser sessions and automatic token refresh;
- successful login can restore across refresh/reopen while valid;
- no project password storage or parallel custom auth storage;
- explicit sign-out clears authenticated state;
- shared team-name to internal Auth identity resolver.

### A2 — Account-aware shell
Status: COMPLETE

Implemented and production-verified:
- initialize/restore Supabase session before auth-dependent UI;
- unauthenticated users see team-name + password login;
- authenticated users enter the league application automatically;
- current Auth user resolves to one real league account;
- My Team resolves to the logged-in team;
- Jakin Goff alone displays **Commissioner** from real account role;
- normal MEMBER accounts receive member presentation;
- explicit logout;
- valid persisted sessions survive refresh/reopen while valid;
- desktop/mobile share the same authenticated account/session model;
- project code stores no passwords.

PR #33 hardened A2 behavior:
- approved account identity maps to a stable immutable roster manager ID;
- unknown/inconsistent identity fails closed instead of falling back to Jakin/Vuk;
- Miku007 / Lovro maps to Miku's roster;
- account switches clear stale previous-account dashboard state;
- Commissioner authorization is separate from roster identity;
- live Players data restored by accepting valid signed Form / Total Points values.

### A3 — Team profiles + avatars
Status: CURRENT / NEXT

Goal:
Add persistent league-visible team profiles and avatars using the established Supabase backend and account identity model.

Approved scope:
- Team profile table/data.
- Avatar upload/update.
- Teams page consumes persistent profiles.

Non-negotiable boundaries:
- persistent profile/avatar state must use Supabase/Postgres/Storage, not authoritative localStorage;
- profile/avatar writes must be owner-scoped or explicitly Commissioner-authorized through backend/RLS/storage policies;
- no browser exposure of service-role/secret credentials;
- preserve the six existing account identities and immutable roster-manager mapping;
- desktop/mobile consume the same profile data;
- do not pull G1 real FPL Draft league/entry identity into A3;
- do not mix Trading Block, scoring, lineup persistence, or unrelated player-photo work into A3.

Implementation details are intentionally left to Codex after repository inspection.

## Team / Gameweek tracking
### G1 — Real FPL Draft league/entry identity
Status: AFTER A3
- Obtain real league ID and six entry IDs safely.
- Verify league-specific read schemas.

### G2 — League Gameweek + standings adapter
- Real current Gameweek on League page.
- Real league standings.
- Manager overall/season points through the standings model.
- Logged-in manager's current Gameweek points where verified.

### G3 — Gameweek lineup domain + persistence
Build the authoritative shared lineup entity used by both mobile and desktop, with backend-enforced member ownership, Gameweek lock, and audited Commissioner post-start administration as already defined.

### G4 — Account-specific My Team + Teams Gameweek presentation
- football-pitch XI positioned by derived formation;
- shared lineup renderer/model for My Team and Teams;
- separate ordered bench;
- verified player photos when P1/P2 are available, otherwise neutral fallback.

### G5 — Gameweek scoring
### G5A — Important Gameweek event feed
### G6 — Commissioner score corrections

## Player improvements
### P1 — Premier League photo identity research
### P2 — Player photos
### P3 — Stats/status adapter
### P4 — Usage classification
### P5B — Enriched Players filtering/sorting

## Transactions / trading
### T1 — Trading Block
### T2 — Trade proposals
### T3 — Player comparison
### T4 — Real FPL transaction reconciliation

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
- Authorization-sensitive writes must be enforced in backend/RLS/storage policies.
- Account roster identity must resolve through the approved immutable mapping and fail closed on inconsistency.
- Commissioner authorization must not determine roster identity.
- Player display names use the full verified available name.
- Free Agent/Owned state derives from current roster ownership.
- Formation/lineup legality belongs in shared domain logic.
- Do not build project scoring before lineup and player-Gameweek contracts exist.
- Do not automate official FPL writes before read/reconciliation behavior is proven.
- Do not guess Premier League image URLs or identity mappings.
- Do not let a live feed overwrite immutable draft-day evidence.
- Do not skip A3 and start G1 unless Vuk explicitly changes the roadmap.