# Data Architecture and Sources

## Principle
Use the simplest reliable official/public source for factual FPL Draft league state. Use Supabase for project-created companion state. Scrape only when required data genuinely cannot be obtained from a reliable official/public source.

## Source hierarchy

### 1. Canonical custom draft history
`src/data/leagues/kile-n-others/officialDraft2026-27.json`

Owns:
- exact 90-pick Kile N Others custom draft;
- draft order;
- final draft rosters;
- draft-time ranking/model/MVP evidence.

This is historical authority and never changes.

The official FPL Draft choices endpoint mirrors selections entered into the platform after the custom draft and is integration evidence only.

### 2. Current official FPL Draft league state
G1 verified:
- league ID `45938`;
- six entry IDs;
- six league-entry IDs;
- `/api/league/45938/details`;
- `/api/draft/45938/choices` as identity evidence.

G2 must verify current 2026/27 contracts for the smallest useful set of:
- `/api/game` — current Gameweek/status/timing;
- `/api/entry/{entry}/event/{event}` — official manager Gameweek team / XI / bench semantics;
- `/api/event/{event}/live` — live player scoring/events;
- `/api/event/{event}/fixtures` — fixture/kickoff/result state;
- `/api/league/{league}/element-status` — current ownership/free-agent/locked state;
- league details standings fields — finalized/delayed official standings/season totals;
- official transaction/waiver/trade read routes where currently available and useful.

Candidate routes are not contracts until actually observed and normalized.

### 3. Project-created companion state
Supabase owns:
- Auth/accounts/sessions;
- team profiles/avatars;
- non-authoritative pre-GW lineup planner state;
- Trading Block;
- trade proposals/responses;
- preferences/watchlists;
- historical snapshots where required for stable Archive/analytics.

Do not store manual duplicates of official lineups, ownership, Gameweek score or standings merely because persistence is available.

## Target data ownership
| Data | Authority / preferred source |
|---|---|
| Canonical custom draft history | Immutable repository snapshot |
| Current player pool / official Draft rank | FPL Draft bootstrap via project boundary |
| Real league + entry identity | G1 committed verified identity contract |
| Current Gameweek / timing | verified official `/api/game` contract |
| Fixtures/results | verified official event fixtures |
| Official active/completed lineup | verified official entry/event contract |
| Live player GW points/events | verified official event-live contract |
| LIVE/provisional team total | project calculation from verified official lineup + live player state |
| LIVE/provisional standings | project calculation from finalized base + six live team totals |
| Finalized GW/season totals | verified official league/entry result data |
| Current ownership/free agents | verified official league element-status |
| Official ownership changes | verified transaction/waiver/trade read contracts |
| Team profiles/avatars | Supabase |
| Lineup tester/planner | Supabase project state if persistence is useful |
| Trading Block/trade negotiation | Supabase project state |
| Archive snapshots | Supabase/project persistence where needed |

## Live standings rule
Do not treat delayed official standings as the only active-GW table.

During active play:
1. begin from the last finalized season totals/standings baseline;
2. consume all six verified official active lineups;
3. join live per-player Gameweek points;
4. calculate live/provisional team totals;
5. calculate live/provisional standings/rank movement immediately as upstream live data changes;
6. label state as LIVE/provisional and show freshness.

When the official Gameweek is finalized, reconcile to official finalized totals/standings.

Codex must verify exact semantics before implementation, especially bench/autosub/bonus/finalization behavior.

## Current ownership rule
Once `element-status` semantics are verified, official FPL Draft ownership becomes current live ownership authority.

The immutable custom draft remains historical starting-state authority. Never rewrite it to match current ownership.

## Transactions rule
Trading Block/proposals are companion-app workflow. They do not themselves alter official ownership.

A verified official ownership or transaction change is the evidence that a move actually occurred in the live league.

## Player identity
Never assume regular FPL and FPL Draft IDs are interchangeable without evidence. Explicit mappings/contracts only; conflicts fail closed.

## Data freshness / polling
For six league users, live reads should be automatic but responsible:
- use project-owned server boundary/caching where appropriate;
- during active matches poll frequently enough for a genuinely live experience once API behavior/rate limits are understood;
- outside active play reduce refresh frequency substantially;
- expose `LIVE · updated … ago` or equivalent freshness status;
- do not claim an event before the upstream official source reflects it.

## Provenance
Distinguish at minimum:
- Custom draft historical
- Official current
- LIVE / provisional project-calculated from official inputs
- Official finalized
- Project-created planner/trade state
- Unavailable/unverified
