# Current Phase

## G1 — Real FPL Draft league/entry identity
Status: CURRENT / NEXT

The A family is complete and production-verified. G1 is the first G-family step.

## Verified baseline entering G1
Current verified `main`:
`a62d027d310efa08dbdd22dc53bf17818a863fec`

Hosted KNO Supabase has all current repository migrations applied:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

A-family production behavior is working:
- team-name + password authentication;
- persistent Supabase-managed sessions;
- logout;
- six authoritative league accounts;
- stable account -> immutable roster manager identity;
- no fallback to Jakin/Vuk;
- Jakin Goff alone as Commissioner;
- persistent team profiles;
- private owner-managed avatars;
- shared My Team/Teams profile state;
- compact mobile profile/current-roster presentation;
- live Players data.

## Why G1 is now
The application knows who its six product users/teams are, but it does **not yet know the verified official FPL Draft identity of the real Kile N Others league**.

Before the League page can safely consume real standings, Gameweek data, official entry squads, ownership or transaction history, the project needs a trustworthy bridge between:

```text
our six product identities
        ↕
real FPL Draft league + six official entries
```

G1 builds and verifies that bridge.

## Plain-English goal
Find the real official FPL Draft identifier for **Kile N Others**, identify the six official entries/managers inside that league, and prove exactly which official entry belongs to each of our six existing teams.

Then verify the relevant read-only FPL Draft response structure well enough that G2 can safely build real Gameweek/standings data on top of it.

G1 establishes identity and evidence. It does not yet redesign the League page or display real standings.

## Product identities that must map exactly
- Jakin Goff -> Vuk -> immutable Vuk roster -> `LEAGUE_OWNER` / Commissioner
- Dindi -> Kristian -> immutable Kristian roster -> `MEMBER`
- 22nd oBlock -> Diego -> immutable Diego roster -> `MEMBER`
- Miku007 -> Lovro -> immutable Miku roster -> `MEMBER`
- Rod Wave Disciples -> Deni -> immutable Deni roster -> `MEMBER`
- Tintilinic -> Tin -> immutable Tin roster -> `MEMBER`

Do not infer mapping from array position, draft order, role, first result, or fuzzy name similarity when stronger evidence is available.

## Required outcome
1. Verified real FPL Draft league ID for Kile N Others.
2. Exactly six verified official entry IDs belonging to that league.
3. Explicit one-to-one mapping from each official entry to one existing project account/team and immutable roster manager ID.
4. Verified read-only league-specific endpoint/schema evidence sufficient for G2.
5. Fail-closed handling for missing, duplicate or conflicting identities.
6. Concise provenance/evidence for how the mapping was established.

## Candidate read routes
Existing research has identified candidates including:
- `/api/league/{league}/details`
- `/api/entry/{entry}/event/{event}`
- `/api/league/{league}/element-status`
- `/api/draft/league/{league}/transactions`
- `/api/draft/league/{league}/trades`

Global/public candidates remain:
- `/api/game`
- `/api/event/{event}/fixtures`
- `/api/event/{event}/live`

Codex must verify what is actually useful now rather than assuming every candidate route is valid.

## Security / privacy boundary
G1 is read-only.
- do not request/store Vuk's FPL Draft password;
- do not commit browser cookies, auth tokens or private FPL credentials;
- do not add an automated official FPL login flow;
- do not add mutation/write calls;
- league IDs and entry IDs are identity references, not authorization authority.

If the league URL/ID can only be obtained from Vuk's authenticated FPL Draft browser, Codex should complete all other available work first and then give one minimal **Manual verification for Vuk** action.

## Architecture rules
- external FPL/FPL Draft shapes stop at project-owned boundaries;
- official identity mappings should be explicit and independently testable;
- existing `league_accounts` remain application identity authority;
- existing immutable roster-manager mapping remains roster identity authority;
- official entry identity is an integration mapping and must not rewrite either authority;
- identity conflicts fail closed;
- do not mutate immutable official draft history;
- do not introduce G2/G3 persistence or presentation early.

## In scope
- repository investigation relevant to league/entry identity;
- safe acquisition/verification of the real league ID;
- safe acquisition/verification of six entry IDs;
- exact mapping to the six project identities;
- focused project-owned identity/config/domain/adapter contracts if justified;
- read-only endpoint/schema verification;
- deterministic mapping/validation tests;
- concise evidence/provenance sufficient for G2.

## Out of scope
Do not implement:
- G2 real standings/Gameweek UI;
- current Gameweek points presentation;
- G3 lineup persistence/locking;
- G4 football-pitch lineup presentation;
- G5/G5A scoring/live event UI;
- G6 Commissioner score corrections;
- player-photo work;
- Trading Block/trades;
- automatic official FPL mutations.

## Acceptance criteria
G1 is complete only when:
- the real Kile N Others league ID is verified;
- exactly six official entry IDs are verified as members of that league;
- each official entry maps uniquely to one existing project identity and immutable roster manager ID;
- no mapping relies on positional/first-row fallback;
- contradictory identity evidence fails closed;
- relevant league-specific read schemas were actually observed rather than invented;
- project-owned contracts introduced are tested;
- no passwords/tokens/cookies/private FPL credentials are committed or exposed;
- no official FPL write path is introduced;
- A-family login/session/profile/roster behavior is not regressed;
- relevant checks pass;
- any manual-only external-browser step is isolated under **Manual verification for Vuk** with exact action, expected result and failure signal.

## Workflow for G1
- continue the current Codex session while useful;
- start from current `main` on one fresh short-lived G1 branch;
- Codex owns repository/external-contract investigation, implementation strategy and tests;
- prefer one coherent commit and avoid unnecessary progress commits;
- open one Draft PR;
- ChatGPT independently reviews the actual diff/evidence;
- Vuk alone merges;
- do **not** edit `Second_Brain/**` during G1 implementation.

Second Brain will not be reconciled after G1 alone. Continue through the approved G-family roadmap, with one consolidated G-family reconciliation after the G work is complete unless an earlier correction becomes necessary.

## Next phase after G1
After G1 is merged and verified, proceed to:

**G2 — League Gameweek + standings adapter**

G2 will use the verified identity/read contracts from G1 to bring real current Gameweek and league standings data into the application.
