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
- Jakin Goff — Vuk — LEAGUE_OWNER
- Dindi — Kristian — MEMBER
- 22nd oBlock — Diego — MEMBER
- Miku007 — Lovro — MEMBER
- Rod Wave Disciples — Deni — MEMBER
- Tintilinic — Tin — MEMBER

No public self-sign-up is required.

## Login UX
The visible login form should use:
- Team name
- Password

Supabase Auth may use an internal email identity behind the scenes. Users should not need to interact with that internal identifier.

## Password decision
A shared password for all six users is incompatible with meaningful admin security because anyone who knows Jakin Goff's team name and shared password can authenticate as the league owner.

Therefore:
- Jakin Goff must use a unique admin password.
- Prefer unique passwords for all six accounts.
- Do not commit passwords to the repository, migrations, Second Brain, or frontend.

## Authorization
Important permissions must be enforced in Supabase/Postgres RLS or equivalent backend checks.

Frontend visibility is UX only, not security.

Suggested roles:
- MEMBER
- LEAGUE_OWNER

## Initial permission model
All authenticated league members may:
- read the league and public-to-league team profiles;
- read current league squads and submitted league-visible lineups;
- read league player/transaction/trading-block data intended for members;
- update their own permitted profile fields;
- submit/update their own pre-deadline lineup;
- manage their own Trading Block entries;
- create/respond to trade proposals where they are a participant.

Only LEAGUE_OWNER may:
- correct another team's points;
- perform approved maintenance/reconciliation operations;
- repair incorrect roster/sync state through explicit admin workflows;
- access other admin-only controls.

## Team profile photos
Use Supabase Storage, conceptually:
`team-avatars/<auth-user-id>/avatar.*`

Policy intent:
- league members can read avatars;
- user can replace their own avatar;
- league owner may repair/manage where necessary.

## Secrets
Never commit:
- Supabase service-role key
- passwords
- auth cookies
- access/refresh tokens
- private FPL credentials

Public client configuration may be supplied through environment variables as appropriate, while privileged keys remain server-only.

## RLS workflow
For every table added:
1. Define who owns the row.
2. Define who may read it.
3. Define who may insert/update/delete it.
4. Add focused policy tests/manual verification.
5. Verify admin privileges at the backend level.

Do not rely on `isAdmin` React conditionals as the permission boundary.

## Authentication scope boundary
Initial auth phase should only establish:
- six pre-created accounts;
- login/logout/session;
- account identity -> team mapping;
- RLS foundation;
- admin role.

Do not mix Trading Block, scoring, Matchday sync, or complex profiles into the initial auth task.