# Kile N Others — Second Brain

## Purpose
This folder is the project control manual. The GitHub repository, committed code, migrations, database state, tests, and verified deployed state remain the technical source of truth. The Second Brain records approved architecture, product rules, current status, and roadmap intent so Codex does not repeatedly rediscover the project.

The existing top-level notes primarily describe the **Kile N Others FPL Draft product**. The private Fantacalcio side project has its own retrieval-oriented area at:

`Second_Brain/Fantacalcio/00_HOME.md`

## Product principle
Kile N Others is a private six-team FPL Draft companion that should be **better than the Premier League Draft app, not a copy of it**.

Use official/public FPL Draft data for factual league state that already exists there. Use this app to provide faster live standings, richer live lineup presentation, research, planning, trading workflows, historical analysis, profiles, and other league-specific features FPL Draft does not provide well.

Do not ask managers to manually duplicate reliable official information.

## Canonical draft truth
The repository's 2026/27 custom draft is the real Kile N Others draft:
`src/data/leagues/kile-n-others/officialDraft2026-27.json`.

The league used a custom draft process and then manually entered those selections into the Premier League Draft platform. Therefore the FPL Draft `/api/draft/{league}/choices` result is useful integration/identity evidence, but it is **not** the historical draft authority.

Never rewrite the custom draft archive to mirror later platform state.

## Current baseline
- F0/F1/F2/P5A/F3: COMPLETE.
- A1/A1.5/A2/A3: COMPLETE and production-verified.
- A family: COMPLETE.
- G1 official league/entry identity: COMPLETE in PR #38 / commit `ec1197ebbf615e63390b6a156a59fe403e292dc8` once merged.
- Real FPL Draft league ID: `45938`.
- G2 Official League State Contracts: CURRENT / NEXT after G1 merge.
- Production: `https://fpl-draft-assistant-eight.vercel.app/`.
- Hosted Supabase: KNO (`asrrkwyqerfkynhjypov`).

These historical status labels may lag newer merged repository work. For current technical status, inspect `main`, merged PRs and deployed evidence before relying on this summary.

## Verified official league identity
G1 establishes one explicit fail-closed bridge from the six product identities to the official FPL Draft league and entries.

| Product team | Manager | Roster ID | Entry ID | League-entry ID |
|---|---|---|---:|---:|
| Jakin Goff | Vuk | `demo-manager-1` | 240560 | 242345 |
| Dindi | Kristian | `demo-manager-3` | 240676 | 242463 |
| 22nd oBlock | Diego | `demo-manager-2` | 240707 | 242494 |
| Miku007 | Lovro | `demo-manager-4` | 240723 | 242510 |
| Rod Wave Disciples | Deni | `demo-manager-6` | 261369 | 263632 |
| Tintilinic | Tin | `demo-manager-5` | 261515 | 263779 |

Official display-name differences are evidence only; they are not product identity authority.

## Source-of-truth split
```text
CUSTOM DRAFT HISTORY
repo immutable 90-pick snapshot
        ↓
Draft / Archive history

OFFICIAL FPL DRAFT LIVE STATE
league + entry + event + live + ownership + transaction reads
        ↓
project-owned adapters / normalized contracts
        ↓
live standings, official lineups, ownership, events, finalized results

PROJECT-CREATED STATE
Supabase Auth/Postgres/Storage/RLS
        ↓
accounts, profiles, avatars, lineup planner, Trading Block,
trade proposals, preferences, historical snapshots where needed
```

## Gameweek product direction
When a Gameweek is not active, **My Team is a lineup tester / decision workspace**. It may persist app-specific planner state, but it does not submit or replace the official FPL Draft lineup.

When a Gameweek is active, the app automatically reads the official FPL Draft lineup and shows live team/player points. Teams uses the same official/live state for all six managers.

The League page should calculate a continuously updating **LIVE / provisional table** from verified official lineup and live-player data rather than waiting for the lagging finalized FPL standings table. Once the Gameweek is finalized, official finalized totals/standings become authoritative.

No manual lineup submission, manual Gameweek score entry, or Commissioner score/lineup correction system is part of the current target.

## Current ownership / transactions direction
After the relevant contracts are verified, official FPL Draft ownership is the current live ownership authority. Trades, waivers and free-agent changes should flow into the app automatically.

Our Transactions experience remains an upgrade layer: research, Trading Block, proposals, responses, comparisons, waiver analysis and later recommendation support. An in-app accepted proposal does not change official ownership; official FPL Draft execution/reconciliation does.

## Archive direction
The current Draft Archive will evolve into **Archive** with:
- the canonical custom draft history;
- completed Gameweek lineups and player points;
- each manager's Gameweek score;
- season total and league position after each Gameweek;
- final standings snapshots and later season/rank analytics.

## Non-negotiable architecture rules
- external FPL/FPL Draft response shapes stop at project-owned adapters;
- official data and project-created data have explicit provenance;
- current live ownership must not overwrite custom draft history;
- mobile and desktop share one underlying domain/data state;
- profile data is not account/roster identity authority;
- account -> immutable roster identity remains fail-closed;
- no official FPL mutation automation without separate explicit approval;
- no passwords, cookies, tokens or privileged secrets in source/browser code;
- live views expose freshness/provisional/finalized state truthfully.

## Workflow
Use narrow short-lived branches and Draft PRs. Codex owns implementation details after repository inspection. ChatGPT defines product outcome, invariants, scope and acceptance criteria, then independently reviews the PR. Vuk alone merges.

Prefer one coherent commit per narrow roadmap step.

Second Brain updates are **approval-gated**. Codex may propose a consolidated end-of-family reconciliation or an earlier material correction, but it must show the proposed files/actions/content and wait for Vuk's explicit approval before editing `Second_Brain/**`.

For model/effort guidance and execution strategy, see `docs/workflow/AI_MODEL_POLICY.md` and `16_Codex_Session_Workflow.md`.

## Next phase
For FPL, inspect current `main` and the latest merged PRs before following historical phase labels in these notes.

For Fantacalcio, start at `Fantacalcio/00_HOME.md`.
