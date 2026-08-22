# Decision Log

## D-001 — Preserve the official draft as immutable history
Status: APPROVED

The completed 2026/27 Kile N Others draft remains the canonical historical base. Later trades, waivers, free-agent moves, scoring, profiles and lineups must not rewrite it.

## D-002 — Evolve, do not replace, the Draft Assistant
Status: APPROVED

Keep the useful original draft functionality and model evidence in the repository while the default product becomes a season-long league dashboard.

## D-003 — Repository/code/database are technical truth
Status: APPROVED

Second Brain is a concise control manual, not a replacement for implementation truth.

## D-004 — Low-token Codex workflow
Status: APPROVED

Future Codex tasks are narrow. Read only relevant Second Brain notes, implement one change, run targeted tests, independently verify, then manually update Second Brain.

## D-005 — Vercel is the deployment target
Status: APPROVED

Deploy the existing current app before making Supabase/auth a dependency.

## D-006 — Desktop and mobile are both first-class
Status: APPROVED

Kile N Others must keep a strong desktop experience and also provide an intentionally usable mobile experience within the same application. Responsive/mobile work must not replace, downgrade or remove desktop functionality. New user-facing features should normally support both layouts and share one domain/data model.

## D-007 — Responsive shell is an early isolated phase
Status: APPROVED

Make the deployed current shell responsive before adding the bulk of league features. Do not mix responsive work with backend/auth work.

## D-008 — Supabase for minimum persistent backend
Status: APPROVED ARCHITECTURE; F3 COMPLETE

Use Supabase Auth + Postgres + RLS + Storage for six accounts and project-owned persistent league state.

## D-009 — Team-name login UX
Status: APPROVED

The visible login uses team name + password. Internal Supabase auth identities may use hidden/generated email identifiers.

## D-010 — Admin credentials cannot be shared
Status: APPROVED SECURITY CORRECTION

Jakin Goff must use a unique admin password. A shared password across all known team names would allow any member to authenticate as the league owner, making RLS unable to distinguish the real admin.

## D-011 — Backend permissions, not frontend hiding
Status: APPROVED

Admin-sensitive and owner-sensitive permissions must be enforced via RLS/backend authorization.

## D-012 — Missing Gameweek lineup remains unsubmitted
Status: APPROVED — UPDATED

Never reuse a previous Gameweek lineup if a manager forgot to submit one. Submission state remains explicitly missing/unsubmitted.

For presentation only, Teams may display an automatically generated valid XI + bench when no lineup was submitted. That fallback must be labeled as automatic/not submitted, must not become the authoritative lineup, and receives zero project-calculated lineup points.

## D-013 — Score provenance is explicit
Status: APPROVED

Prefer: admin correction > verified official FPL total > project-calculated total from a valid submitted lineup > unavailable. Corrections retain an audit trail and do not erase source values. Automatically generated unsubmitted fallback lineups are not eligible for project-calculated lineup points.

## D-014 — Accepted trade is not processed trade
Status: APPROVED

An accepted in-app trade does not change current rosters until real-FPL reconciliation or explicit league-owner confirmation marks it PROCESSED.

## D-015 — Prefer official/public data over scraping
Status: APPROVED

Scraping is a fallback only for genuinely missing required data.

## D-016 — Premier League photos require a verified mapping contract
Status: APPROVED RESEARCH DIRECTION

Investigate stable FPL/player identity -> official Premier League profile/image mapping. Do not guess CDN URLs or manually maintain hundreds of photos before proving the source contract.

## D-017 — External API shapes stop at adapters
Status: APPROVED

React consumes project-owned models. Undocumented FPL/FPL Draft response structures do not become UI contracts directly.

## D-018 — No automatic official FPL mutations yet
Status: APPROVED

Read/reconcile before automating any official trade, waiver, free-agent or lineup mutation.

## D-019 — Model usage by task difficulty
Status: APPROVED WORKFLOW

Use Luna for trivial mechanical work, Terra for normal implementation, and Sol for architecture/security/data research/major verification.

## D-020 — Codex leads repository-heavy technical planning
Status: APPROVED WORKFLOW

For problems where correct decisions depend heavily on the actual repository, Codex should inspect the codebase, plan the technical solution and implement it. This includes UI/component architecture, CSS, refactors, debugging, implementation-level state organization and focused test strategy.

ChatGPT should primarily define product intent, architecture boundaries, data/security rules, roadmap constraints and acceptance criteria, then independently verify Codex's claimed repository changes. ChatGPT should not micromanage exact code structure when Codex has materially better repository visibility.

## D-021 — Mobile and desktop share one persistent application state
Status: APPROVED ARCHITECTURE

Mobile and desktop are presentation layers of one application, not separate products. Persistent mutable league data must use the same backend/database contracts on both form factors.

A lineup submitted on mobile must be visible on desktop, and a later desktop edit/submission must be visible on mobile after both read the shared backend state.

No device-specific authoritative lineup state and no authoritative localStorage persistence.

## D-022 — Formation derives from the submitted XI
Status: APPROVED PRODUCT RULE

Formation is not an independent cosmetic setting. It is derived from the positions of the 11 selected starters subject to valid FPL lineup constraints.

Example: 3 DEF + 5 MID + 2 FWD is 3-5-2. Replacing a FWD starter with a DEF produces 4-5-1 if the resulting XI remains legal.

Formation and lineup-validity rules belong in shared domain logic, not in mobile-only presentation code.

## D-023 — Gameweek bench order is persistent meaningful data
Status: APPROVED PRODUCT RULE

The lineup bench contains one substitute goalkeeper followed by ordered outfield substitutes 1, 2 and 3. Bench order is part of the persistent Gameweek lineup entity and must be shared across mobile and desktop.

## D-024 — League home is Gameweek-first
Status: APPROVED PRODUCT DIRECTION

The main League page prioritizes current Gameweek context, the logged-in manager's Gameweek points, standings, important verified football/Gameweek events and recent transactions.

Draft summary metrics, roster completeness, large Draft Archive calls to action and draft-history activity are secondary and should not dominate the League home page.

## D-025 — Mobile primary navigation order
Status: APPROVED PRODUCT DIRECTION

Primary mobile navigation is League, My Team, Teams and More. Players moves under More together with Matchday, Transactions and Draft Archive.

The mobile navigation should be floating/rounded, safe-area aware, touch-friendly and use restrained polished animation while respecting reduced-motion preferences.

## D-026 — Fantacalcio-style lineup is presentation inspiration, not copied branding
Status: APPROVED PRODUCT DIRECTION

My Team and Teams should eventually use an original football-pitch lineup presentation inspired by the supplied Fantacalcio reference: starters visually positioned by derived formation, real verified Premier League player photos when available, names visible, and an ordered bench underneath.

Do not copy proprietary branding or assets. My Team owns editing controls; Teams reuses the lineup rendering model for viewing other managers.

## D-027 — Jakin Goff is the league Commissioner
Status: APPROVED PRODUCT / AUTHORIZATION RULE

Jakin Goff remains the backend `LEAGUE_OWNER` account and is displayed in the product as **Commissioner**. The title is user-facing; authorization continues to rely on the stable backend role and RLS policies.

## D-028 — Gameweek lineup writes lock for members at kickoff
Status: APPROVED PRODUCT / SECURITY RULE

Before a Gameweek starts, each MEMBER may create, edit and submit only their own lineup.

Once the verified Gameweek start/deadline is reached, MEMBER accounts may no longer insert, edit, replace or submit a lineup for that Gameweek.

Jakin Goff / `LEAGUE_OWNER` / Commissioner may insert, edit or replace a lineup for itself or any other manager after kickoff as a privileged administrative action. These writes must be enforced through backend/RLS authorization and audited when lineup persistence is implemented. The lock must not depend only on client-side time.

## D-029 — Successful login persists on the device without storing the password
Status: APPROVED AUTHENTICATION RULE

After a successful team-name + password login, the browser/device should restore a still-valid Supabase Auth session automatically across refreshes and later reopening so the user does not need to enter the password every time.

Project code must never persist the password. Supabase-managed session/access/refresh-token behavior provides persistence and refresh. Explicit logout clears the persistent authenticated session.

Session restoration is an authentication convenience only. MEMBER/LEAGUE_OWNER authorization remains database/RLS controlled and must never be inferred from local browser state.

## D-030 — Auth-dependent UI waits for session initialization
Status: APPROVED AUTH UX RULE

The account-aware shell must distinguish `INITIALIZING`, `AUTHENTICATED`, and `UNAUTHENTICATED` states. It should not briefly show the login state while a valid persisted Supabase session is still being restored.

A2 should consume the project-owned auth session service rather than create a second session lifecycle or duplicate Supabase client.