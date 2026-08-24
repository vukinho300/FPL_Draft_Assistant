# Authentication and Security

## Goal
Keep authentication simple for a six-person private league while enforcing real backend authorization for privileged operations.

## Approved backend
Supabase Auth + Postgres + RLS + Storage is the approved persistent backend.

## Account model
Exactly six team accounts:
- Jakin Goff — Vuk — `LEAGUE_OWNER` — Commissioner
- Dindi — Kristian — `MEMBER`
- 22nd oBlock — Diego — `MEMBER`
- Miku007 — Lovro — `MEMBER`
- Rod Wave Disciples — Deni — `MEMBER`
- Tintilinic — Tin — `MEMBER`

No public self-sign-up is required. `Commissioner` is user-facing copy; backend authorization uses `LEAGUE_OWNER` and RLS.

## Current implementation state
- F3 Supabase foundation: COMPLETE.
- A1 accounts/RLS: COMPLETE.
- A1.5 persistent sessions: COMPLETE.
- A2 account-aware shell: COMPLETE and production-verified.
- A3 team profiles + avatars: COMPLETE and production-verified.
- **A family: COMPLETE.**
- **G1 real FPL Draft league/entry identity: CURRENT / NEXT.**

## Hosted production state
Hosted KNO project ref: `asrrkwyqerfkynhjypov`.

Applied migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

Verified state includes six league accounts, one owner/five members, six team profiles, private owner-managed avatars, RLS, disabled public signup, six real Auth users, and browser-safe Vercel Supabase variables only.

## Login/session behavior
- visible login: team name + password;
- Supabase-managed session restore across refresh/reopen while valid;
- explicit logout;
- project code does not store passwords;
- current Auth user resolves to one application account;
- Jakin Goff alone receives Commissioner presentation.

## Roster identity separation
After PR #33:
- approved account identity resolves to one immutable roster manager ID;
- Miku007 / Lovro resolves to Miku's roster;
- Jakin Goff / Vuk resolves to Vuk's roster;
- unknown/inconsistent identity fails closed;
- account switches clear stale prior-account dashboard state;
- Commissioner role does not determine roster identity.

Do not reintroduce display-name, first-roster or role-based roster fallback.

## Team profile / avatar authorization
A3 is complete:
- `team_profiles` is one-to-one with authoritative `league_accounts`;
- editable profile data is presentation data, not identity authority;
- normal members may update only their own permitted avatar metadata;
- authenticated league members may read league-visible profiles/avatars;
- avatars live in a private Storage bucket with owner-scoped writes;
- Commissioner has no implicit blanket cross-team avatar editing;
- account switching must not leak stale profile state.

## G1 security boundary
G1 is read-only official FPL Draft identity work.
- do not request/store/commit FPL passwords, cookies, tokens or private credentials;
- league/entry IDs are identity references, not authorization authority;
- do not add official FPL mutation/write behavior;
- if a browser-only identifier is needed, Vuk performs the minimum manual action while Codex continues everything else;
- official entry mapping must be explicit and fail closed on conflicts.

## Secrets
Never commit or expose Supabase secret/service-role keys, passwords, auth cookies/tokens, or private FPL credentials.

Important permissions must remain enforced by backend/RLS rather than React conditionals or browser state.
