# Authentication and Security

## Goal
Keep authentication simple for a six-person private league while enforcing real backend authorization for project-created privileged operations.

## Approved backend
Supabase Auth + Postgres + RLS + Storage remains the approved persistent backend for product-created state.

## Account model
Exactly six product accounts:
- Jakin Goff — Vuk — `LEAGUE_OWNER` — Commissioner
- Dindi — Kristian — `MEMBER`
- 22nd oBlock — Diego — `MEMBER`
- Miku007 — Lovro — `MEMBER`
- Rod Wave Disciples — Deni — `MEMBER`
- Tintilinic — Tin — `MEMBER`

No public self-sign-up is required. `Commissioner` is user-facing copy; backend project authorization uses `LEAGUE_OWNER` and RLS.

## Current implementation state
- F3 Supabase foundation: COMPLETE.
- A1 accounts/RLS: COMPLETE.
- A1.5 persistent sessions: COMPLETE.
- A2 account-aware shell: COMPLETE and production-verified.
- A3 profiles/avatars: COMPLETE and production-verified.
- G1 official FPL Draft league/entry identity: COMPLETE once PR #38 is merged.
- G2 Official League State Contracts: CURRENT / NEXT after G1 merge.

## Hosted production state
Hosted KNO project ref: `asrrkwyqerfkynhjypov`.

Applied migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

Verified state includes six league accounts, one owner/five members, six team profiles, private owner-managed avatars, RLS, disabled public signup, six real Auth users and browser-safe Vercel Supabase variables only.

## Login/session behavior
- visible login: team name + password;
- Supabase-managed session restore across refresh/reopen while valid;
- explicit logout;
- project code does not store passwords;
- current Auth user resolves to one application account;
- Jakin Goff alone receives Commissioner presentation.

## Roster identity separation
Application account identity, immutable custom-draft roster identity, mutable profile presentation and official FPL Draft entry identity are separate concerns.

After PR #33:
- approved account identity resolves to one immutable roster manager ID;
- Miku007 / Lovro resolves to Miku's roster;
- Jakin Goff / Vuk resolves to Vuk's roster;
- unknown/inconsistent identity fails closed;
- account switches clear stale prior-account state;
- Commissioner role does not determine roster identity.

G1 adds a separate explicit mapping to league `45938` and six official entry IDs. Official names/IDs are integration references, not authentication or authorization authority.

## Team profile / avatar authorization
- `team_profiles` remains one-to-one with authoritative `league_accounts`;
- editable profile data is presentation data, not identity authority;
- normal members update only their own permitted profile/avatar fields;
- avatars stay private with owner-scoped writes and authenticated league reads;
- Commissioner has no implicit blanket cross-team avatar editing.

## Official FPL Draft security boundary
The redesigned G family is read-only toward official FPL Draft unless a later separate decision explicitly authorizes writes.

Do not request/store/commit:
- FPL passwords;
- browser cookies;
- access/session tokens;
- private FPL credentials.

League IDs, entry IDs, league-entry IDs and public official read responses are identity/data references, not secrets or project authorization authority.

Do not add automated official lineup/trade/waiver/free-agent mutation calls in G2-G6.

## Commissioner clarification
Commissioner remains a privileged product/account role where project-created state genuinely needs administration.

The target no longer includes Commissioner editing/replacing official Gameweek lineups or manually correcting official scores in this companion app.

## Secrets
Never commit or expose Supabase secret/service-role keys, passwords, auth cookies/tokens or private FPL credentials.

Important permissions for project-created writes remain backend/RLS enforced rather than inferred from React conditionals or browser state.
