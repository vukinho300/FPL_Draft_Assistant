# Fantacalcio — 9-Hour Official-Auction Sprint

## Purpose

Deliver the smallest reliable Fantacalcio system that can be trusted during the imminent 2026/27 official auction inside a hard **9-hour total project timebox**.

This file is a temporary delivery override, not a replacement for the full roadmap.

The full roadmap in `05_Roadmap_Status.md` resumes after the auction.

## Delivery rule

The sprint optimizes for:

**auction reliability > useful decision support > architecture completeness > polish.**

Do not sacrifice:
- authorization/security;
- deterministic budgets and ownership;
- roster-slot legality;
- recoverable corrections;
- real source provenance;
- explicit uncertainty.

Do sacrifice/defer:
- broad refactors;
- repeated onboarding;
- extensive documentation churn;
- complex modelling without proven incremental value;
- mobile polish;
- Monte Carlo/simulation unless the core tool is already ready.

A simple validated baseline is preferable to a sophisticated model that cannot be validated before the auction.

## Completed before sprint execution

### FA0 — COMPLETE
Rules and architecture frozen sufficiently for implementation.

### FA1 — COMPLETE
Production-verified:
- Vuk-only Fantacalcio access;
- blue product shell;
- Fantacalcio ↔ FPL switching;
- login/logout regression check;
- capability/RLS enforcement.

## Must-ship auction core

The auction must not begin without:

1. reliable persistent auction state;
2. 8 configured managers;
3. 500 initial credits each;
4. 25-player roster constraints:
   - 3 POR
   - 8 DIF
   - 8 CEN
   - 6 ATT
5. minimum purchase price = 1;
6. exact remaining budget;
7. exact remaining slots by role;
8. duplicate ownership prevention;
9. deterministic maximum legal bid;
10. fast sale recording;
11. safe correction/undo;
12. auction history;
13. real player pool/search;
14. laptop-usable workflow;
15. backup/export or equivalent recovery path before the live auction.

## Sprint sequence

### FA2-S — Reliable auction ledger
Build the deterministic domain/persistence core:
- auction session;
- managers;
- nominations/sales;
- budgets;
- role slots;
- ownership;
- minimum-price legality;
- max-legal-bid invariant;
- correction/undo;
- persistence;
- invariant tests.

Do not wait for player modelling.

### FA3-S — Laptop auction recorder
Build only what makes live entry fast:
- player search;
- sale confirmation;
- manager board;
- visible budgets/slots;
- history;
- correction;
- keyboard-friendly flow;
- recovery/export.

Avoid cosmetic detours.

### FD1-S — Emergency source selection
Perform a fast but serious source audit focused on the first release.

Select the minimum trustworthy source set for:
- official/usable Fantacalcio Classic listone and roles;
- current Serie A player/team identity;
- historical/current Fantacalcio performance where accessible;
- current minutes/starts/availability evidence;
- any advanced statistic only if reliable, timely and materially useful.

Record source/version/retrieval time and known limitations.

Do not build a large provider framework.

### FD2-S — Minimum canonical player dataset
Create only the canonical current player layer needed by the auction:
- stable internal identity;
- name;
- club;
- role;
- source identity;
- availability/status fields needed for ranking;
- provenance.

Critical identity conflicts must be explicit.

### FM-S — Defensible baseline projection
If source coverage permits, produce a leakage-safe remaining-season baseline using the strongest simple evidence available within the timebox.

Potential inputs:
- historical Fantacalcio performance;
- current 2026/27 evidence;
- minutes/starts;
- role;
- goals/assists/underlying statistics when trustworthy;
- set pieces/penalties;
- team strength;
- current availability;
- historical reliability;
- base-vote consistency for defense-modifier-relevant players.

Use shrinkage/recency logic appropriate to small current-season samples.

Do not launch the full FM4 tournament unless core auction readiness is already complete and the comparison can finish without delaying release.

### FE-S — Auction value layer
Convert the baseline into immediately useful guidance:
- position scarcity;
- replacement value;
- fair credits;
- hard max legal bid;
- recommended bid ceiling only when supported by the remaining-player/budget state.

Hard legal max remains deterministic and separate from recommended max.

Do not build full FE3 Monte Carlo unless spare time remains after rehearsal.

## Parallelism

After FA1, product and data tracks may proceed independently:

```text
PRODUCT
FA2-S → FA3-S
             \
              FINAL AUCTION APP
             /
DATA
FD1-S → FD2-S → FM-S → FE-S
```

Do not create cross-track blockers unless technically required.

## Cut line

### Non-negotiable
- FA2-S;
- FA3-S core;
- real player pool;
- persistence/recovery;
- full rehearsal.

### Strong target
- FD1-S;
- FD2-S;
- baseline ranking;
- simple scarcity/fair-credit guidance.

### Defer before risking core delivery
- full FM4 model tournament;
- extensive hyperparameter tuning;
- full FE2 opponent market modelling;
- FE3 Monte Carlo;
- FA4 polish;
- mobile optimization;
- continuous refresh/retraining infrastructure;
- speculative opponent psychology.

## Sprint workflow

For each task:

1. synchronize clean `main`;
2. read only the minimum relevant Second Brain/code;
3. create a short-lived branch;
4. implement one narrow deliverable;
5. run all available automated checks;
6. open Draft PR;
7. report exact verification and blockers;
8. ChatGPT performs delta review;
9. Vuk merges;
10. immediately start the next critical task.

Do not rerun full onboarding between sprint tasks.

Do not create a Second Brain update after every sprint task. Propose documentation only for:
- a durable decision;
- a significant blocker/change of strategy;
- the final auction-ready checkpoint.

## Model/reasoning use during sprint

Use the least expensive model that remains safe for the task.

Suggested capability allocation:
- auth/RLS/security: stronger reasoning;
- deterministic ledger/business invariants: strong/standard reasoning;
- mechanical UI integration/polish: standard;
- source-selection research: frontier/deep reasoning if available;
- statistical design/model baseline: frontier/deep reasoning;
- repetitive cleanup: fast/mechanical.

Do not spend higher reasoning effort on CSS or routine wiring when it could be reserved for data/model correctness.

## Final auction-ready gate

Before the real auction:

- production app reachable;
- Vuk authentication works;
- Fantacalcio opens;
- real player pool loads;
- all 8 managers initialized correctly;
- all budgets start at 500;
- roster constraints are correct;
- at least one simulated sale per role succeeds;
- duplicate purchase is blocked;
- illegal overbid is blocked;
- undo/correction restores exact prior state;
- refresh/relogin preserves authoritative state;
- export/backup/recovery path works;
- FPL product still opens;
- frozen source/projection release IDs are visible if ranking/value data is used.

If decision-support data is incomplete, the recorder must still remain usable without fake recommendations.
