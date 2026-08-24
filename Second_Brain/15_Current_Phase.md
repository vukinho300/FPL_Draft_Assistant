# Current Phase

## G2 — Official League State Contracts
Status: CURRENT / NEXT after G1 PR #38 merges

This phase definition intentionally supersedes the old G2/G3 manual-lineup plan because G1 proved that the project can safely identify and read the real Kile N Others FPL Draft league.

## Dependency
G2 must start only after G1 PR #38 is merged.

G1 verified:
- official league ID `45938`;
- exactly six official entry IDs;
- exactly six league-entry IDs;
- exact mapping to the six product identities and immutable custom-draft roster IDs;
- project-owned league-details/draft-choice adapters;
- fail-closed identity validation;
- reproducible live league verifier.

## Product principle for G2+
FPL Draft should supply factual current/live league state that it already knows. Our app should use those facts to provide a better league experience rather than ask users to enter the same information again.

The repository custom draft remains historical draft authority. Official FPL Draft becomes the target live/current authority for state such as active lineups, ownership and finalized results once each contract is verified.

## Plain-English G2 goal
Find out exactly what the current 2026/27 official FPL Draft APIs give us for:
- what Gameweek we are in and whether it is active/finalized;
- each manager's actual Gameweek XI/bench;
- each player's live points/events;
- current ownership/free-agent state;
- fixtures and game status;
- finalized standings/season totals;
- official transactions/waivers/trades where useful.

Then turn only the verified useful parts into project-owned normalized contracts with strong tests.

G2 is the evidence/data-contract foundation for G3-G6. It is not the final UI phase.

## Verified league identities to use
- Jakin Goff / Vuk -> entry `240560`, league-entry `242345`
- Dindi / Kristian -> entry `240676`, league-entry `242463`
- 22nd oBlock / Diego -> entry `240707`, league-entry `242494`
- Miku007 / Lovro -> entry `240723`, league-entry `242510`
- Rod Wave Disciples / Deni -> entry `261369`, league-entry `263632`
- Tintilinic / Tin -> entry `261515`, league-entry `263779`

Do not remap these by response order or fuzzy names.

## Candidate contracts to verify
Candidate routes already identified include:
- `/api/game`
- `/api/event/{event}/fixtures`
- `/api/event/{event}/live`
- `/api/entry/{entry}/event/{event}`
- `/api/league/45938/element-status`
- `/api/league/45938/details`
- official transaction/waiver/trade read routes discovered from current FPL Draft behavior/repository research.

Do not assume historical/community endpoint shapes are current. Observe actual 2026/27 responses.

## Required G2 outcomes

### A. Current Gameweek contract
Verify:
- current Gameweek/event identifier;
- deadline/timing fields;
- how to determine pre-GW vs active vs finished/finalized safely;
- any difference between fixture completion and FPL Draft finalization.

### B. Official lineup contract
For all six verified entry IDs, verify the entry/event response and determine:
- which 15 players are returned;
- exact starting XI semantics;
- exact bench/order semantics;
- any substitute/captain-like fields that exist;
- whether the endpoint changes during/after the Gameweek;
- behavior before the Gameweek is available;
- player ID identity contract needed to join current player/live data.

This contract is what will eliminate manual lineup submission.

### C. Live player scoring/event contract
Verify event-live data needed later for:
- live per-player Gameweek points;
- goals;
- assists;
- yellow/red cards;
- penalty saves;
- bonus/other scoring fields where relevant;
- update/freshness behavior.

Do not invent event semantics from field names alone when ambiguous.

### D. Fixture/activity contract
Verify fixture data needed to know:
- kickoff times;
- started/finished/provisional state;
- whether the Gameweek is actively changing;
- when live refresh should increase/decrease.

### E. Current ownership/free-agent contract
Verify league element-status semantics:
- available/owned/locked status;
- owner identity field;
- join owner to G1 official entry/league-entry identity;
- whether all current roster players/free agents can be derived safely;
- behavior immediately after waiver/free-agent/trade changes.

Once proven, this contract is the target live current-roster authority.

### F. Standings/finalization contract
Using league details and any other necessary official read, verify:
- rank;
- Gameweek/event total;
- season total;
- when those fields update;
- whether they lag while matches are live;
- what signal means the values are finalized enough for Archive/reconciliation.

Do not implement the final LIVE standings engine here; only provide the facts/contracts G3 needs.

### G. Transaction read contracts
Narrowly investigate official transaction/waiver/trade reads if available and useful.

G2 does not need to implement the Transactions page. The goal is to determine whether later G5/T4 can automatically identify ownership changes and classify their provenance.

### H. Archive feasibility
Determine what historical completed-GW lineup/score/standings data can be read retrospectively and what later needs project snapshots to guarantee stable Archive history.

Do not build Archive yet.

## Architecture rules
- raw official responses stop at project-owned service/adapter boundaries;
- use the existing G1 identity artifact rather than duplicate IDs;
- current official state never rewrites the immutable custom draft;
- no authoritative localStorage;
- do not add Supabase tables simply to duplicate official current facts;
- if later snapshots are needed, document the evidence/reason but do not pull full Archive persistence into G2 unless essential to proving the contract;
- ambiguous/missing identity or schema must fail closed;
- keep desktop/mobile UI out of external schema contracts.

## Live product requirements G2 must prepare for
Later G3 must be able to calculate:
- six LIVE team totals;
- LIVE/provisional standings;
- rank movement immediately when official live player points change;
- points gaps;
- finalized reconciliation.

Later G4 must be able to show:
- inactive-GW lineup tester;
- active-GW official lineup;
- live team points above lineup;
- live points on each player;
- formation/list/bench.

Later G5 must be able to show:
- live scoring events;
- ownership/waiver/trade changes;
- league-relevant event impact.

G2 should design normalized contracts that make these possible without prematurely implementing them.

## Security/privacy
Read-only official FPL Draft work only.

Do not:
- ask for/store FPL passwords;
- commit cookies/tokens/private credentials;
- automate official lineup/trade/waiver/free-agent mutations;
- expose privileged Supabase keys.

## Out of scope for G2
Do not build:
- final League-page LIVE table UI;
- final My Team/Teams pitch/list lineup UI;
- automatic polling UX;
- player-photo UI;
- lineup planner persistence;
- Trading Block/proposal flows;
- Archive UI/history persistence;
- notifications;
- Commissioner score/lineup corrections;
- official FPL write paths.

## Acceptance criteria
G2 is complete when repository evidence demonstrates that:
- the current Gameweek/activity contract is verified;
- official lineup semantics are verified for all six G1 entries or failures are clearly explained;
- live per-player scoring/event fields needed by later phases are verified;
- fixtures/activity/finalization signals are understood sufficiently for later refresh/reconciliation logic;
- current ownership/free-agent semantics are verified and join uniquely to G1 identities;
- official standings/event/season total timing/provenance is observed rather than assumed;
- useful transaction reads are verified or explicitly ruled unavailable/out of scope with evidence;
- Archive historical-read/snapshot needs are understood;
- project-owned normalized contracts/adapters and deterministic tests exist where implementation is justified;
- fail-closed behavior covers malformed/duplicate/missing mappings;
- no official writes or private credentials are introduced;
- relevant typecheck/tests/build/lint and live verification pass.

## Workflow
- continue the same Codex session while useful;
- branch fresh from `main` after both G1 and this product-direction docs correction are merged;
- one narrow G2 implementation branch;
- prefer one coherent commit;
- open one Draft PR;
- ChatGPT reviews actual diff/evidence/CI;
- Vuk alone merges;
- do not edit Second Brain during G2 unless another material architecture correction becomes necessary.

## Next phase after G2
**G3 — Live Scoring + LIVE Standings Engine**.
