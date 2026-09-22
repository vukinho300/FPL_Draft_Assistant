# Fantacalcio — 5-Hour Official-Auction Sprint

## Purpose

Approximately **five hours remain** to deliver the private 2026/27 Fantacalcio auction assistant.

This is a temporary delivery override, not a replacement for the long-term roadmap.

The product core is already built. The remaining sprint is now about proving the data, generating defensible decision support, integrating it, and rehearsing the auction.

## Current completed state

### FA0 — COMPLETE
Rules/architecture frozen sufficiently for implementation.

### FA1 — COMPLETE
Production-verified Vuk-only Fantacalcio access.

### FA2-S — COMPLETE
Production ledger supports:
- 8 managers;
- 500 credits;
- 3 POR / 8 DIF / 8 CEN / 6 ATT;
- minimum price 1;
- hard max legal bid;
- duplicate-sale protection;
- append-only sale/undo history;
- RLS/capability enforcement.

### FA3-S — COMPLETE
PR #50 merged:
- laptop recorder;
- manager board;
- authoritative reload/replay;
- manual player fallback;
- undo/history;
- JSON backup/export.

### FD1-S — COMPLETE
Source research is sufficient to stop broad provider hunting.

## New delivery rule

The remaining sprint optimizes for:

**data integrity > defensible baseline model > auction economics > integration polish.**

The deadline may reduce model complexity or feature count.

It may **not** reduce:
- identity correctness;
- duplicate detection;
- match/season coverage checks;
- missingness accounting;
- source provenance;
- temporal leakage safety;
- target-leakage safety;
- chronological evaluation.

If the rich dataset fails the gate, use a smaller clean dataset.

Do not force dirty data into the model.

## Source strategy for tonight

### Primary bootstrap — 0novanta/tool-asta-fantacalcio
Inspect and pin the real repository artifacts, including as applicable:
- 2026/27 quotations/listone;
- historical Fantacalcio statistics/quotations;
- season-organized advanced statistics;
- public SQLite dataset.

Use only fields/artifacts that pass independent validation.

### Current-season enrichment — piopy/fantacalcio-py
Inspect the live acquisition approaches and smoke-test only the sources needed for freshness.

Potentially useful:
- current minutes/starts;
- current production;
- xG/xA where available;
- injuries/status;
- likely starter evidence;
- penalties/set pieces.

Do not depend on private credentials, opaque providers or brittle workarounds merely because the reference project contains them.

### API-Football — fallback
Use only if required current evidence cannot be verified from the bootstrap/current-source stack.

Do not introduce paid/provider complexity by default.

### uPeppe/fantabeto — modelling reference
Use for modelling ideas only:
- vote vs fantavote;
- goalkeeper separation;
- uncertainty;
- defense-modifier implications.

Do not use its older scraper as the current ingestion layer.

## Phase 1 — FD2-QA: canonical release + integrity audit

This is the **next task** and is upstream of every model.

Build current-player-first canonical data and then prove its quality.

### Required outputs
- pinned source manifest;
- canonical 2026/27 selectable player pool;
- historical/current feature tables actually needed;
- identity mapping report;
- fixture/coverage report where match-level data is used;
- missingness report;
- cross-source reconciliation report;
- temporal/leakage field classification;
- machine-readable data-quality report;
- Data Quality Score;
- `AUCTION_POOL_READY` verdict;
- `MODEL_READY` verdict.

### Data Quality Score

| Component | Weight |
| --- | ---: |
| Provenance & reproducibility | 10 |
| Schema & value validity | 10 |
| Identity & duplicate integrity | 20 |
| Coverage & missingness | 20 |
| Cross-source consistency | 15 |
| Temporal / leakage safety | 25 |
| **Total** | **100** |

`MODEL_READY` requires score >= 90 **and** zero critical hard failures.

### Hard failures
At minimum:
- wrong season/competition;
- missing current Classic role;
- unresolved current identity collision;
- duplicate canonical/sample keys that affect weighting/identity;
- silent many-to-many join explosion;
- materially missing fixtures/gameweeks used as complete training data;
- orphan match rows;
- parse failures silently mapped to zero;
- undocumented freshness;
- temporal leakage;
- target leakage;
- train/test overlap.

No model starts until this passes.

## Phase 2 — after MODEL_READY: parallelize

Only after FD2-QA freezes an approved canonical release should parallel sessions begin.

### Session A — FM-S
Build a simple, leakage-safe remaining-season baseline.

Prefer:
- recency/shrinkage;
- empirical Bayes;
- Ridge/ElasticNet only if the training target and chronological validation are defensible.

Required:
- chronological split;
- explicit prediction cutoffs;
- shuffled-target negative control;
- random-feature/noise control;
- simple baseline comparison;
- uncertainty flags.

No large model tournament.

### Session B — FA3-DATA integration
Integrate the frozen **current canonical player pool** into the recorder:
- searchable real player list;
- stable `playerRef`;
- role auto-filled from canonical data;
- club shown;
- already-sold state derived from ledger;
- manual fallback retained only as emergency recovery.

Do not add fake projections.

This session can proceed from `AUCTION_POOL_READY`; it does not need to wait for FM-S.

## Phase 3 — FE-S

After FM-S produces a reviewed projection release:
- replacement level by role;
- scarcity;
- fair credits;
- recommended max ceiling;
- keep hard legal max separate.

No Monte Carlo before the auction.

If model readiness fails, FE-S must not fabricate model-derived prices. Current FVM/quotation may be displayed only as clearly labelled external reference data when provenance is valid.

## Phase 4 — integrate + freeze + rehearse

Final production work:
- load frozen canonical/projection/value release;
- expose release/data-as-of and warnings;
- preserve authoritative ledger;
- simulate auction workflow;
- verify backup/export;
- freeze release ID.

## Five-hour target allocation

This is a priority allocation, not a promise:

1. **0:00–1:20 — FD2-QA**
   - canonical release;
   - integrity tests;
   - DQ score;
   - AUCTION_POOL_READY / MODEL_READY verdict.

2. **1:20–2:20 — parallel**
   - Session A: FM-S if MODEL_READY;
   - Session B: canonical player-pool integration if AUCTION_POOL_READY.

3. **2:20–3:15 — FE-S**
   - only from approved model output.

4. **3:15–4:15 — integration/deployment**
   - rankings/values into app;
   - release metadata;
   - resolve integration defects.

5. **4:15–5:00 — rehearsal/fix/freeze**
   - production checks;
   - backup;
   - final release freeze.

If FD2-QA takes longer, cut modelling sophistication first.

Never cut the integrity gate.

## Parallel-session rules

- Do **not** run two sessions that mutate the same worktree.
- The FD2-QA data worktree owns research/data files until the canonical release is frozen.
- After that release exists, create separate branches/worktrees for:
  - FM-S;
  - FA3-DATA integration.
- FE-S waits for reviewed FM-S output.
- External reference repositories live outside the project Git history.
- No session edits Second Brain during routine sprint work.

## Release readiness

### AUCTION_POOL_READY
Required for real search:
- every selectable current player has unique identity;
- Classic role present;
- club/eligibility explicit;
- no unresolved current collision;
- source/version/checksum recorded.

### MODEL_READY
Required for statistical predictions:
- AUCTION_POOL_READY;
- DQ score >= 90;
- zero critical hard failures;
- zero temporal leakage;
- zero target leakage;
- zero split overlap.

If only AUCTION_POOL_READY succeeds, the recorder may still use the real player pool without statistical recommendations.

## Final auction-ready gate

Before the real auction:
- production app reachable;
- Vuk auth works;
- real canonical player pool loads;
- all 8 managers/500 credits/3-8-8-6 correct;
- search → sale workflow works;
- duplicate purchase blocked;
- illegal overbid blocked;
- undo restores state;
- refresh/relogin preserves state;
- export backup works;
- FPL still opens;
- data/projection release ID and data-as-of visible if recommendations are used;
- any recommendation shown comes only from a `MODEL_READY` release.

If the model misses the deadline, ship the trustworthy recorder + canonical pool rather than a contaminated ranking.
