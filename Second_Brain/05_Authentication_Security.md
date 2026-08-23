# Authentication and Security

## Goal
Keep authentication simple for a six-person private league while enforcing real backend authorization for privileged operations.

## Approved backend
Supabase Auth + Postgres + RLS + Storage is the approved persistent backend.

## Account model
Exactly six team accounts:
- Jakin Goff — Vuk — `LEAGUE_OWNER` — product-facing title: Commissioner
- Dindi — Kristian — `MEMBER`
- 22nd oBlock — Diego — `MEMBER`
- Miku007 — Lovro — `MEMBER`
- Rod Wave Disciples — Deni — `MEMBER`
- Tintilinic — Tin — `MEMBER`

No public self-sign-up is required.

`Commissioner` is a product-facing title. Backend authorization uses the stable `LEAGUE_OWNER` role and RLS rather than UI copy.

## Current implementation state
- F3 Supabase client/config/migration foundation: COMPLETE.
- A1 six-account schema/RLS foundation: COMPLETE.
- A1.5 persistent session/auth lifecycle foundation: COMPLETE.
- A2 account-aware shell: COMPLETE and production-verified.
- A3 team profiles + avatars: CURRENT / NEXT.

## Hosted production state
Hosted Supabase project:
- name: KNO
- project ref: `asrrkwyqerfkynhjypov`

Applied hosted migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`

Verified production state:
- six `league_accounts` rows;
- exactly one `LEAGUE_OWNER` and five `MEMBER` rows;
- Jakin Goff is the only league owner;
- RLS enabled;
- anonymous account access blocked;
- intended authenticated account reads allowed;
- public signup disabled;
- email/password authentication remains enabled;
- six real Supabase Auth users provisioned with private passwords held by Vuk;
- Vercel production has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- no service-role/secret credential is exposed to the frontend;
- production authentication works.

## Login/session behavior
Visible login uses:
- Team name
- Password

Internal Supabase Auth email identifiers are implementation details and must remain hidden from the user-facing login.

A2 production behavior is verified:
- unauthenticated users see team-name + password login;
- authenticated users enter the league app;
- a valid Supabase-managed session restores across normal refresh/reopen while valid;
- explicit logout signs out and clears authenticated state;
- project code does not store passwords;
- current Auth user resolves to one application league account;
- Jakin Goff alone gets Commissioner presentation from real account role;
- other accounts retain normal MEMBER presentation.

Supabase-managed browser sessions are authentication convenience only. MEMBER/LEAGUE_OWNER authorization remains database/RLS controlled.

## Roster identity separation
Account authorization and roster identity are separate concerns.

After PR #33:
- approved account/team + manager identity resolves to one immutable official-draft roster manager ID;
- Miku007 / Lovro resolves to Miku's roster;
- Jakin Goff / Vuk resolves to Vuk's roster;
- unknown or inconsistent account identity fails closed instead of falling back to Jakin/Vuk;
- switching authenticated accounts clears stale prior-account dashboard state while the new account resolves;
- Commissioner role does not influence which roster is selected.

Do not reintroduce display-name fallback, first-roster fallback, or role-based roster selection.

## Password decision
Jakin Goff uses a unique private admin password. Prefer unique passwords for all six accounts.

Never commit passwords to the repository, migrations, Second Brain, frontend, or logs.

## Authorization
Important permissions must be enforced in Supabase/Postgres RLS or equivalent backend checks. Frontend visibility is UX only, not security.

Roles:
- `MEMBER`
- `LEAGUE_OWNER`

A1 established the league-account identity/RLS foundation so authenticated users map to one league account and normal members cannot self-promote or mutate another league identity.

Future authorization rules for Gameweek lineups, score correction, trading, and maintenance remain as defined in the roadmap and league-rules notes and must be backend-enforced when implemented.

## A3 team profile / avatar security intent
A3 is the next narrow phase.

Approved product scope:
- persistent team profile table/data;
- avatar upload/update;
- Teams page consumes persistent profiles.

Security/data rules:
- persistent profile data belongs in Supabase, not authoritative localStorage;
- normal users may update only profile fields explicitly permitted for their own account/team;
- league-visible profile/avatar reads may be shared with authenticated league members;
- privileged repair behavior, if needed, must derive from `LEAGUE_OWNER` backend authorization;
- avatar files use Supabase Storage under an account-owned path/contract chosen from repository evidence;
- no service-role/secret credential in browser code;
- no public signup or broad anonymous profile mutation;
- do not mix G1 league/entry identity into A3.

## Secrets
Never commit or expose:
- Supabase secret/service-role key
- passwords
- auth cookies
- access/refresh tokens
- private FPL credentials

Public client configuration may use browser-safe Vite environment variables; privileged keys remain server/local-admin only.

## RLS workflow
For every table/storage policy added:
1. Define who owns the row/object.
2. Define who may read it.
3. Define who may insert/update/delete it.
4. Add focused policy verification.
5. Verify owner/Commissioner privileges at the backend level where relevant.

Do not rely on React conditionals, localStorage role strings, or persisted browser state as the permission boundary.