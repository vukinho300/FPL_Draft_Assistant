# Authentication and Security

## Goal
Keep authentication simple for a six-person hobby project while enforcing real backend authorization for admin-sensitive operations.

## Approved backend
Use Supabase incrementally for:
- Auth
- Postgres
- Row Level Security
- Storage

Do not add enterprise identity infrastructure.

## Account model
Exactly six initial team accounts:
- Jakin Goff — Vuk — LEAGUE_OWNER — product-facing title: Commissioner
- Dindi — Kristian — MEMBER
- 22nd oBlock — Diego — MEMBER
- Miku007 — Lovro — MEMBER
- Rod Wave Disciples — Deni — MEMBER
- Tintilinic — Tin — MEMBER

No public self-sign-up is required.

`Commissioner` is the product-facing league title for Jakin Goff. Backend authorization continues to use the stable `LEAGUE_OWNER` role rather than treating UI copy as a security primitive.

## Current implementation state
- F3 Supabase client/config/migration foundation: COMPLETE.
- A1 six-account schema/RLS foundation: COMPLETE.
- A1.5 persistent session/auth lifecycle foundation: COMPLETE.
- A2 account-aware shell: CURRENT.

The application now has a project-owned Supabase Auth session service over the single browser client. The session service exposes startup/session lifecycle behavior for the account-aware shell without making client state the authorization authority.

## Login UX
The visible login form should use:
- Team name
- Password

Supabase Auth uses deterministic internal email identities behind the scenes. Users should not need to interact with those internal identifiers.

## Persistent login / automatic session restore
After a successful login on a browser/device, the user should not have to enter the password every time the app is refreshed or reopened while the Supabase session remains valid.

Rules:
- project code never stores the password;
- Supabase browser auth uses `persistSession: true`;
- Supabase manages access/refresh tokens and automatic refresh;
- startup session state distinguishes `INITIALIZING`, `AUTHENTICATED`, and `UNAUTHENTICATED`;
- the app must allow Supabase to restore a persisted session before deciding that the user is logged out;
- explicit logout calls Supabase sign-out and clears the persistent authenticated state;
- one active session per browser profile is sufficient;
- separate devices/browsers maintain their own sessions;
- no custom localStorage/sessionStorage password or role system is allowed.

Persistent browser authentication does not grant authorization by itself. MEMBER/LEAGUE_OWNER privileges continue to come from database-backed account identity and RLS.

## Password decision
A shared password for all six users is incompatible with meaningful admin security because anyone who knows Jakin Goff's team name and shared password could authenticate as the league owner.

Therefore:
- Jakin Goff must use a unique admin password.
- Prefer unique passwords for all six accounts.
- Do not commit passwords to the repository, migrations, Second Brain, or frontend.

## Authorization
Important permissions must be enforced in Supabase/Postgres RLS or equivalent backend checks.

Frontend visibility is UX only, not security.

Roles:
- MEMBER
- LEAGUE_OWNER

A1 established the application league-account identity/RLS foundation so authenticated users map to one league account and normal members cannot self-promote or mutate another league identity.

## Initial permission model
All authenticated league members may:
- read the league and league-visible team identities/profiles;
- read current league squads and submitted league-visible lineups when those features exist;
- read league player/transaction/trading-block data intended for members;
- update only explicitly permitted own-profile fields in later phases;
- create/edit/submit only their own lineup before the verified Gameweek start/deadline;
- manage their own Trading Block entries when implemented;
- create/respond to trade proposals where they are a participant when implemented.

After the Gameweek starts, MEMBER accounts may not insert, edit, replace or submit lineups for that Gameweek.

Only LEAGUE_OWNER / Commissioner may:
- insert, edit or replace a lineup for Jakin Goff or any other manager after the Gameweek starts;
- correct another team's points;
- perform approved maintenance/reconciliation operations;
- repair incorrect roster/sync state through explicit admin workflows;
- access other admin-only controls.

Commissioner post-start lineup writes must be enforced at the backend/RLS level and should be auditable with actor, target manager, Gameweek, timestamp and reason/note where appropriate.

The Gameweek lock must be based on verified server/backend Gameweek timing rather than only a client-side clock.

## Team profile photos
Use Supabase Storage, conceptually:
`team-avatars/<auth-user-id>/avatar.*`

Policy intent:
- league members can read avatars;
- user can replace their own avatar;
- league owner may repair/manage where necessary.

## Secrets
Never commit:
- Supabase secret/service-role key
- passwords
- auth cookies
- access/refresh tokens
- private FPL credentials

Public client configuration may be supplied through environment variables as appropriate, while privileged keys remain server/local-admin only.

## RLS workflow
For every table added:
1. Define who owns the row.
2. Define who may read it.
3. Define who may insert/update/delete it.
4. Add focused policy tests/manual verification.
5. Verify commissioner/admin privileges at the backend level.

Do not rely on `isAdmin` React conditionals, stored role strings, or persisted browser state as the permission boundary.

## A2 scope boundary
A2 should connect the completed A1/A1.5 identity/session foundations to the application shell:
- initialize/restore session before rendering auth-dependent UI;
- show team-name + password login when unauthenticated;
- show the league app when authenticated;
- resolve authenticated user to the correct league team/account;
- make My Team resolve to the authenticated team;
- expose Commissioner/member UI from real account role;
- provide logout;
- preserve automatic login on valid persisted sessions.

A2 must not weaken RLS by replacing backend authorization with frontend-only checks.

Do not mix Trading Block, scoring, Matchday sync, Gameweek lineup persistence, or complex profiles into A2.