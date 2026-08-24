# Project Status

## Date context
August 24, 2026.

## Baseline
A family is complete and production-verified.

G1 is implemented in PR #38 (`feature/g1-official-league-identity`, commit `ec1197ebbf615e63390b6a156a59fe403e292dc8`) and is the dependency for this documentation correction. This docs PR must not merge before G1.

Once PR #38 is merged, G1 is COMPLETE and G2 becomes CURRENT / NEXT.

## G1 verified identity
Official FPL Draft league:
- ID: `45938`
- official name: `Kile n Others`

Mappings:
- Jakin Goff / Vuk / `demo-manager-1` -> entry `240560`, league-entry `242345`
- Dindi / Kristian / `demo-manager-3` -> entry `240676`, league-entry `242463`
- 22nd oBlock / Diego / `demo-manager-2` -> entry `240707`, league-entry `242494`
- Miku007 / Lovro / `demo-manager-4` -> entry `240723`, league-entry `242510`
- Rod Wave Disciples / Deni / `demo-manager-6` -> entry `261369`, league-entry `263632`
- Tintilinic / Tin / `demo-manager-5` -> entry `261515`, league-entry `263779`

Official naming differences are not product identity authority. G1 proves mappings through exact 15-player platform-choice sets against the immutable project custom-draft rosters.

Observed G1 contracts:
- `GET /api/league/45938/details`
- `GET /api/draft/45938/choices`

G1 added project-owned adapters, committed identity/provenance evidence, fail-closed validation and `npm run verify:fpl-league-live`.

## Critical product correction after G1 discovery
The earlier G roadmap assumed this app would own manual Gameweek lineup submission, score calculation/correction and manually maintained current roster state.

That direction is now superseded.

The target architecture is:
- **custom repository draft** = immutable real draft history;
- **official FPL Draft read APIs** = factual live/current league state once each contract is verified;
- **Supabase** = project-created companion state;
- **our app** = faster/richer experience over those facts, not a duplicate Premier League Draft app.

## Custom draft clarification
The Kile N Others league conducted a custom draft. The Premier League Draft platform's timed/random-order draft was not the league's real drafting process. After the custom draft, the league manually entered the chosen players into FPL Draft.

Therefore:
- repository 90-pick snapshot is canonical draft history;
- platform choices are integration evidence only;
- later official ownership changes do not rewrite draft history.

## New Gameweek direction
No manual Gameweek lineup submission into this app.

Inactive GW:
- My Team = lineup tester / decision workspace;
- planner is non-authoritative project state.

Active GW:
- automatically consume official FPL Draft lineup;
- show LIVE team points;
- show live points/events on players;
- Teams uses same live state for all six managers;
- League computes continuously updating LIVE/provisional standings rather than waiting for delayed finalized FPL standings.

Finalized GW:
- reconcile provisional calculations to official finalized totals/standings;
- preserve completed-GW history for Archive.

## Current ownership direction
Once G2 verifies element-status semantics, official FPL Draft current ownership/free-agent state becomes live roster authority.

Trades, waivers and free-agent moves should update automatically from verified official state. The custom draft remains unchanged.

## Transactions direction
Transactions remains a major companion-app upgrade area:
- Trading Block;
- trade offers/responses/counters;
- multi-player proposals;
- player/roster comparison;
- waiver/free-agent research;
- later recommendation/value models.

In-app acceptance records agreement only. Official FPL execution changes ownership; verified official reads reconcile completion.

## Archive direction
Draft Archive evolves to **Archive**:
- custom Draft history;
- completed GW lineups/bench;
- player GW points;
- team GW points;
- season total after GW;
- league position/rank movement;
- standings snapshots;
- later season progression/analytics.

## Removed from target
- manual Gameweek lineup submission;
- manual score entry;
- manual standings entry;
- manual current-GW selection;
- manual roster maintenance when verified official ownership exists;
- Commissioner lineup overrides;
- Commissioner score corrections.

Jakin Goff remains Commissioner/`LEAGUE_OWNER` for product/account administration where needed.

## Current phase state after G1 merge
- Foundation: COMPLETE
- A family: COMPLETE
- G1: COMPLETE
- **G2 Official League State Contracts: CURRENT / NEXT**
- G3 Live Scoring + LIVE Standings Engine: AFTER G2
- G4 My Team + Teams Gameweek Experience: AFTER G3 / required photo dependencies
- G5 Live League Events + Official Ownership Sync: AFTER G4
- G6 Archive + Gameweek/Season History: AFTER G5

## Next implementation milestone
G2 must verify and normalize the official contracts needed for:
- current Gameweek/timing;
- six official lineups and bench semantics;
- live player scoring/events;
- fixtures/activity/finalization;
- current ownership/free-agent state;
- official standings/finalized totals;
- relevant transaction reads;
- historical availability/snapshot needs for Archive.

G2 should not build the final live UI yet.
