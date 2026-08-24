# Current Architecture

## Verified baseline
A family is complete and production-verified. G1 introduces the verified official league/entry bridge for league `45938` and six official entries.

## Three-source architecture
```text
1. Canonical custom draft history
   repository immutable snapshot

2. Official FPL Draft live state
   league / entry / event / live / ownership / transaction reads
   -> project-owned adapters
   -> normalized internal contracts

3. Project-created companion state
   Supabase Auth/Postgres/Storage/RLS
   -> accounts, profiles, avatars, planner state,
      Trading Block, trade proposals, preferences,
      historical snapshots where needed
```

React must consume project-owned models, not raw undocumented external shapes.

## Historical truth
`src/data/leagues/kile-n-others/officialDraft2026-27.json` is the canonical real 2026/27 Kile N Others draft.

The Premier League Draft choices endpoint mirrors selections that were entered into the platform after the league's custom draft. It may prove integration identity but must not replace custom draft history.

Custom draft history is immutable even when current official ownership changes.

## Account and official identity
Application account authority remains `league_accounts` plus the approved immutable account -> roster manager mapping.

G1 adds a separate official integration mapping:
- league ID `45938`;
- six official entry IDs;
- six league-entry IDs.

Official display names do not control application identity. Mapping conflicts fail closed.

## Live league state direction
Verified official FPL Draft reads should become the factual source for:
- current Gameweek;
- official entry/Gameweek lineup;
- current official player ownership/free-agent state;
- live per-player Gameweek scoring/events;
- official finalized Gameweek/season totals;
- official transactions/waivers/trades where the relevant read contracts are proven.

During an active Gameweek, the app should derive its own **LIVE / provisional standings** from verified official lineup + live player data so rank changes do not wait for delayed finalized league standings.

When official Gameweek results finalize, finalized official values supersede provisional calculations while historical provenance remains clear.

## My Team / Teams modes
Inactive Gameweek:
- My Team is an app-specific lineup tester / decision workspace;
- planner state is non-authoritative and may be persisted in Supabase;
- Teams remains primarily roster/profile/current-state viewing.

Active Gameweek:
- official FPL Draft lineup is automatically consumed;
- My Team and Teams use one shared normalized lineup/live-scoring model;
- live team points and live player points update automatically;
- no duplicate manual lineup submission.

## Supabase responsibilities
Supabase remains authoritative for project-created state:
- authentication/session/account bindings;
- profiles/avatars;
- optional lineup-planner state;
- Trading Block;
- trade proposals/responses;
- app preferences/watchlists;
- historical snapshots/analytics facts that need preservation beyond upstream availability.

Supabase should not become a manually maintained duplicate of official lineups, current ownership, standings or Gameweek scores.

## Transactions architecture
Official ownership is the target live roster authority once its contract is verified.

The app's transaction layer remains useful for research and negotiation. In-app proposal acceptance does not mutate official ownership. A verified official ownership/transaction change later reconciles the move as actually completed.

## Archive architecture
The existing Draft Archive evolves into Archive:
- immutable custom draft section;
- historical completed Gameweeks;
- lineups/bench, player points, team GW totals, season totals, positions and standings snapshots;
- later season/rank analytics.

## Architecture constraints
- no external API shape directly in React;
- no duplicate manual official-state database when a reliable official read exists;
- live calculations expose provisional/finalized provenance;
- live views expose data freshness;
- no duplicate desktop/mobile business logic;
- custom draft history is immutable;
- current official ownership never rewrites draft history;
- account/profile/official-entry identities remain separate concerns;
- no official FPL writes without separate explicit approval;
- secrets/private browser credentials never enter source/browser public config.

## Current phase boundary
G1 identity is complete once PR #38 merges. Next: **G2 — Official League State Contracts**.
