# Current Architecture

## Verified baseline
Current verified `main` is `a62d027d310efa08dbdd22dc53bf17818a863fec` after A3 PR #35 and corrective PR #36.

The deployed application now includes:
- responsive desktop/mobile shell;
- live Players data through the project-owned FPL boundary;
- Supabase Auth/Postgres/RLS/Storage foundation;
- six persistent league accounts and Supabase-managed sessions;
- account-aware My Team;
- persistent team profiles and private team avatars.

## Core flows
```text
External FPL data -> project adapter -> normalized models -> domain logic -> shared dashboard model -> desktop/mobile UI
```

```text
Supabase Auth session
  -> RLS-protected league_accounts
  -> stable approved account -> immutable roster manager ID
  -> shared dashboard model
  -> RLS-protected team_profiles/private avatars
  -> shared My Team / Teams / navigation profile state
```

Raw external response shapes stop at project-owned boundaries. Backend/RLS remains authoritative for permissions.

## Historical truth
`src/data/leagues/kile-n-others/officialDraft2026-27.json` is immutable draft history.

Current rosters derive from immutable final draft rosters plus PROCESSED post-draft transactions. Profile/account/live-data work must never rewrite the historical draft.

## Current persistent backend
Hosted Supabase project: KNO (`asrrkwyqerfkynhjypov`).

Applied hosted migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

Persistent state now includes:
- six `league_accounts` identities;
- one `LEAGUE_OWNER`, five `MEMBER`;
- Auth bindings and persistent sessions;
- six one-to-one `team_profiles`;
- private `team-avatars` Storage with owner-scoped writes and authenticated league reads.

Season-long shared mutable state uses Supabase rather than authoritative localStorage. Legacy Draft Room localStorage remains isolated draft-night behavior.

## Account/roster identity
A2 is complete and production-verified. PR #33 remains a critical invariant:
- stable account -> immutable roster manager ID;
- unknown/inconsistent identity fails closed;
- no Jakin/Vuk fallback;
- Miku007/Lovro -> Miku roster;
- stale account state cleared on account switch;
- Commissioner authorization does not determine roster identity.

## Team profiles + avatars
A3 is complete and production-verified.
- `team_profiles` is one-to-one with authoritative accounts;
- editable profile data is presentation data, not account/role/roster identity authority;
- avatars are private Storage objects;
- normal members write only their own avatar/profile path;
- authenticated league members read league-visible profiles/avatars;
- Commissioner has no implicit blanket cross-team avatar editing;
- missing avatar uses deterministic team-name initial fallback;
- one shared profile model sits above desktop/mobile presentations;
- My Team, Teams and My Team navigation consume the same profile state;
- account switches isolate previous profile state;
- mobile profile/current-roster presentation is compact and remains explicitly not a submitted Gameweek XI.

## Current phase boundary
- F0/F1/F2/P5A/F3: COMPLETE.
- A1/A1.5/A2/A3: COMPLETE.
- **A family: COMPLETE.**
- **G1 Real FPL Draft league/entry identity: CURRENT / NEXT.**

G1 establishes verified official league/entry identity and read-contract evidence. It must not pull G2 standings/Gameweek UI, G3 lineup persistence, or official FPL mutations forward.

## Architecture constraints
- no external API shape directly in React;
- no business-critical permission enforced only by UI hiding;
- no duplicate roster truth;
- no duplicate desktop/mobile business logic;
- no mutable official-draft history;
- persistent mutable league state uses shared backend contracts;
- roster identity fails closed;
- Commissioner authorization and roster identity remain separate;
- profile presentation data is not identity authority;
- real league/entry identity must be verified before league-specific FPL Draft data is trusted;
- no official FPL mutations until explicitly approved.
