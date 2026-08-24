# Roadmap

Build in small dependency-ordered phases. Do not collapse these into one large Codex task.

Second Brain reconciliation happens at the end of a roadmap letter family rather than after every numbered step, unless an earlier correction is needed because the documentation becomes materially false or unsafe.

## Foundation
- F0 Second Brain scaffold — COMPLETE
- F1 Vercel deployment — COMPLETE
- F2 desktop + mobile responsive shell — COMPLETE
- P5A Players filtering/sorting — COMPLETE
- F3 Supabase foundation — COMPLETE

## A family — League accounts/profile foundation
### A1 — Six accounts + RLS
Status: COMPLETE

### A1.5 — Persistent Session / Automatic Login
Status: COMPLETE

### A2 — Account-aware shell
Status: COMPLETE

PR #33 hardening remains part of the baseline: stable account -> immutable roster mapping, no Jakin/Vuk fallback, Miku007/Lovro correction, stale-account protection, Commissioner/roster separation, signed Form/Total Points support, live Players restored.

### A3 — Team profiles + avatars
Status: COMPLETE

Implemented and production-verified through PR #35 plus corrective PR #36:
- one persistent `team_profiles` row per authoritative league account;
- private `team-avatars` Supabase Storage bucket;
- authenticated league-wide profile/avatar reads;
- owner-scoped profile/avatar writes;
- no implicit Commissioner cross-team avatar editing;
- 2 MB JPEG/PNG/WebP contract;
- deterministic team-name initial fallback;
- shared profile state across desktop/mobile and My Team/Teams;
- authenticated-team avatar/fallback in My Team navigation;
- account-switch profile isolation;
- compact mobile profile/current-roster layout that remains truthful about not being a submitted Gameweek XI.

Hosted migration: `20260823163233_team_profiles_avatars.sql`.

**A family status: COMPLETE.**

## G family — Team / Gameweek tracking
### G1 — Real FPL Draft league/entry identity
Status: CURRENT / NEXT

Goal: establish the verified real-world identity contract connecting this project to the actual **Kile N Others** FPL Draft league.

Required outcome:
- verified real FPL Draft league ID;
- verified six official FPL Draft entry IDs;
- explicit one-to-one mapping from those entries to the six existing project identities and immutable roster manager IDs;
- verified read-only league-specific endpoint/schema evidence sufficient for G2;
- fail-closed handling for missing, duplicate or inconsistent mappings;
- evidence/provenance for the identity match.

Boundaries:
- read-only official FPL Draft work only;
- no FPL passwords/cookies/session-token storage;
- no official FPL mutation;
- no fuzzy identity guessing;
- no G2 standings/Gameweek UI yet;
- no lineup persistence/scoring/trades;
- external response shapes remain behind project-owned boundaries when code is introduced.

### G2 — League Gameweek + standings adapter
Status: AFTER G1
- real current Gameweek;
- real league standings;
- manager season points;
- logged-in manager current Gameweek points where verified.

### G3 — Gameweek lineup domain + persistence
Authoritative shared lineup entity with backend-enforced ownership, Gameweek lock and audited Commissioner post-start administration.

### G4 — Account-specific My Team + Teams Gameweek presentation
Football-pitch XI, derived formation, ordered bench, shared renderer/model.

### G5 — Gameweek scoring
### G5A — Important Gameweek event feed
### G6 — Commissioner score corrections

After the approved G-family work is complete and production-verified, perform one consolidated end-of-G Second Brain reconciliation.

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
- Mobile and desktop share one domain/data/backend model.
- Persistent mutable data must not have device-specific authoritative copies.
- Authorization-sensitive writes are backend/RLS/storage enforced.
- Account roster identity uses the approved immutable mapping and fails closed.
- Commissioner authorization must not determine roster identity.
- Team profile/avatar data must not become account/roster identity authority.
- Official league/entry identity must be verified before league-specific FPL Draft data is trusted.
- Do not automate official FPL writes before read/reconciliation behavior is proven.
- Do not guess external IDs, image URLs or identity mappings.
