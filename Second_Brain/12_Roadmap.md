# Roadmap

Build in small dependency-ordered phases. Do not collapse multiple roadmap steps into one oversized Codex task.

Second Brain reconciliation normally happens at the end of a roadmap letter family. This mid-G correction is intentional because verified official league/live-state APIs materially changed the old manual-lineup architecture.

## Foundation
- F0 Second Brain scaffold — COMPLETE
- F1 Vercel deployment — COMPLETE
- F2 desktop + mobile responsive shell — COMPLETE
- P5A Players filtering/sorting — COMPLETE
- F3 Supabase foundation — COMPLETE

## A family — League accounts/profile foundation
- A1 Six accounts + RLS — COMPLETE
- A1.5 Persistent Session / Automatic Login — COMPLETE
- A2 Account-aware shell — COMPLETE
- A3 Team profiles + avatars — COMPLETE

**A family status: COMPLETE.**

## G family — Official league/live Gameweek experience

### G1 — Official FPL Draft league/entry identity
Status: COMPLETE once PR #38 is merged

Verified:
- league ID `45938`;
- exactly six official entry IDs;
- exactly six league-entry IDs;
- explicit one-to-one product/roster mapping;
- official display-name differences retained as evidence, never fuzzy-matched;
- identity proven through exact 15-player platform-choice sets against immutable custom-draft rosters;
- project-owned league-details/draft-choice adapters;
- reproducible live verifier;
- read-only integration only.

Important clarification: the platform choices endpoint is identity evidence, not canonical draft-history authority. The repository custom draft remains the real historical draft.

### G2 — Official League State Contracts
Status: CURRENT / NEXT after G1 merge

Goal: prove and normalize the official 2026/27 read contracts needed by the redesigned G family before building final live UI.

Required research/adapter outcomes where currently available:
- current Gameweek, deadline/timing and active/finalized state;
- entry/event team response for all six verified entries;
- exact starter, XI and bench-order semantics;
- event-live player points and scoring/event fields needed later;
- fixtures/kickoff/finished state;
- current ownership/free-agent/locked state from league element-status;
- owner identity join back to the six G1 entries;
- official standings/event-total/season-total semantics and observed lag/finalization behavior;
- narrowly verify official transaction/waiver/trade read routes if useful and accessible without expanding into transaction implementation;
- document/prove how enough historical completed-GW data can be retrieved or what must later be snapshotted for Archive.

G2 is primarily contracts/adapters/tests/research. Do not build the final League/My Team/Teams redesign yet.

### G3 — Live Scoring + LIVE Standings Engine
Goal:
- join six verified official active lineups to verified live player points;
- calculate each team's LIVE/provisional Gameweek score;
- combine with last finalized season baseline;
- continuously calculate the six-team LIVE/provisional table;
- expose rank movement and points gaps;
- handle upstream freshness/error states truthfully;
- reconcile to official finalized Gameweek/season totals when finalized.

No manual score entry or Commissioner correction system.

### P1/P2 interlude — Player photo identity/photos
If final G4 presentation depends on verified Premier League player imagery, complete the minimum P1/P2 work before or alongside final lineup UI without guessing image mappings.

### G4 — My Team + Teams Gameweek Experience
My Team has two modes:

**Inactive Gameweek — lineup tester / decision workspace**
- current official roster;
- experimental XI + ordered bench;
- derived formation;
- fixtures/form/points/status and later decision-support data;
- planner state may persist in Supabase but is non-authoritative.

**Active Gameweek — official live lineup**
- automatically load official FPL Draft lineup;
- LIVE team points above lineup;
- live points under/on players;
- formation + list view;
- ordered bench;
- shared model across desktop/mobile.

Teams uses the same active official/live model for all six managers.

No duplicate manual lineup submission.

### G5 — Live League Events + Official Ownership Sync
- verified goals/assists/cards/penalty saves and other supported scoring events relevant to league-owned players;
- event feed can show team/point/rank impact;
- verified current ownership/free-agent state becomes live roster authority;
- official waiver/free-agent/trade changes update current ownership automatically;
- surface meaningful ownership changes in Important Events;
- keep custom draft history immutable.

### G6 — Archive + Gameweek/Season History
Evolve Draft Archive into **Archive** with:
- canonical custom draft section;
- completed Gameweek official lineups/bench;
- player GW points;
- team GW totals;
- season totals after each GW;
- league position/rank movement after each GW;
- standings snapshots;
- later rank-over-time and manager/season analytics.

Persist historical snapshots only where required to keep the archive reconstructable/stable.

After G6 is production-verified, perform the normal consolidated end-of-G Second Brain reconciliation.

## Player improvements
### P1 — Premier League photo identity research
### P2 — Player photos
### P3 — Stats/status adapter
### P4 — Usage / starting-likelihood classification
### P5B — Enriched Players filtering/sorting

## Transactions / trading
### T1 — Trading Block
League-visible listings for currently officially owned players.

### T2 — Trade proposals and responses
Offers, multi-player proposals, accept/reject/withdraw/counter-style flows where approved. Agreement inside the app does not change official ownership.

### T3 — Player/roster trade comparison
Use shared stats/fixtures/status/rankings/usage models to support research and evaluate both sides of a proposed trade.

### T4 — Official transaction reconciliation
Verified official ownership/transaction state confirms when an agreed move was actually executed in FPL Draft and reconciles project proposal/history automatically.

### T5 — Waiver/free-agent research hub
Use verified official availability/ownership plus player evidence to research realistic waiver targets and compare target vs drop candidate.

## Later enhancements
### L1 — Start/bench assistant
### L2 — Waiver recommendation assistant
### L3 — Trade-value/fairness model
### L4 — Notifications
Examples: player scores, rank changes, trade offer, watched player availability/waiver outcome, pre-deadline player flag.

### L5 — Manager/season analytics
Examples: rank-over-time, GW wins, highest/lowest score, best waiver, trade impact, bench points, head-to-head weekly comparison.

## Dependency / architecture rules
- repository custom draft is immutable draft-history authority;
- official FPL Draft is the target factual source for current/live league state once each contract is verified;
- Supabase stores project-created companion state, not manual copies of reliable official facts;
- no manual Gameweek lineup submission/score/standings/current-GW entry in the target;
- official current ownership never rewrites custom draft history;
- mobile/desktop share one live/domain model;
- official entry/account/roster/profile identities remain separate and fail closed;
- raw external API shapes stop at adapters;
- LIVE/provisional and finalized values expose provenance/freshness;
- no official FPL mutations without explicit separate approval;
- do not guess player/image/external ID mappings.
