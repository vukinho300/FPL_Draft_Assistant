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

Kile N Others must have a strong desktop experience and an intentionally usable mobile experience within the same application. Responsive/mobile work must not replace, downgrade or remove desktop functionality. New user-facing features should normally support both layouts and share one domain/data model.

## D-007 — Responsive shell is an early isolated phase
Status: APPROVED

Make the deployed current shell responsive before adding the bulk of league features. Do not mix responsive work with backend/auth work.

## D-008 — Supabase for minimum persistent backend
Status: APPROVED ARCHITECTURE; NOT YET IMPLEMENTED

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

## D-012 — Missing Gameweek lineup stays missing
Status: APPROVED

Never fabricate or reuse a previous lineup if a manager forgot to submit one.

## D-013 — Score provenance is explicit
Status: APPROVED

Prefer: admin correction > verified official FPL total > project-calculated total > unavailable. Corrections retain an audit trail and do not erase source values.

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