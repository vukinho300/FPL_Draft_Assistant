# Project Purpose and Requirements

## Product direction
Kile N Others is a private six-team FPL Draft companion for the 2026/27 season. It must preserve the custom draft history while becoming a better league experience than the Premier League Draft app rather than duplicating it.

Official/public FPL Draft data should supply factual league state that already exists there. This app should add faster live standings, richer lineup presentation, research/planning tools, league events, transaction research, trading workflows, profiles, archive/history and later analytics/recommendations.

Do not require manual re-entry of reliable official data.

## League accounts
Exactly six product accounts:
- Vuk -> Jakin Goff
- Kristian -> Dindi
- Diego -> 22nd oBlock
- Lovro -> Miku007
- Deni -> Rod Wave Disciples
- Tin -> Tintilinic

Jakin Goff remains `LEAGUE_OWNER`; user-facing title: **Commissioner**. Commissioner status is a league/account role, not a license to rewrite official lineups or scores.

Login UX remains **team name + password**.

## Custom draft authority
The repository's immutable 90-pick 2026/27 custom draft is the real Kile N Others draft history.

The Premier League Draft platform draft choices were entered after the custom draft because the league did not use the platform's timed/random-order draft process as its real draft procedure.

Therefore:
- repository custom draft = historical draft authority;
- FPL Draft choices endpoint = integration/identity evidence only;
- live FPL ownership may change after the draft without rewriting history.

## Product priorities
1. Preserve immutable custom draft history and useful existing Draft Assistant evidence.
2. Keep strong desktop and intentional mobile experiences.
3. Use official FPL Draft reads for live league state instead of manual duplication.
4. Build continuously updating live standings and live team/player points.
5. Turn My Team into a pre-GW decision workspace and active-GW live lineup experience.
6. Make Teams share the same official/live state for all managers.
7. Automatically synchronize current ownership/waiver/trade changes when verified official contracts allow it.
8. Keep Transactions as an upgraded research/negotiation layer: Trading Block, offers, responses, comparisons and waiver research.
9. Replace Draft Archive with a broader Archive for draft + Gameweek/season history.
10. Add player enrichment, photos, analytics and recommendations only on verified data foundations.

## Target pages
- League
- My Team
- Teams
- Matchday
- Players
- Transactions
- Archive

The legacy Draft Room remains preserved even if not in primary season navigation.

## League page
During an active Gameweek, prioritize:
- current Gameweek;
- authenticated manager's LIVE points;
- continuously updating provisional standings;
- rank movement and points gaps;
- important league-relevant live football events;
- official ownership/waiver/trade changes;
- freshness indicator.

Outside an active Gameweek, show finalized standings and upcoming context.

## My Team
When the Gameweek is not active, My Team is a **lineup tester / decision workspace**:
- current official roster;
- experimental XI/bench and derived formation;
- player stats, form, fixtures, availability and later starting-likelihood evidence;
- player detail modal and comparisons;
- later recommendation support.

Planner state may be persisted for cross-device convenience but is app-specific and non-authoritative.

When the Gameweek is active:
- automatically load the official FPL Draft lineup;
- show LIVE team points above the lineup;
- show LIVE player points on pitch/list players;
- show official XI/ordered bench through the shared lineup model;
- no duplicate manual submission flow.

## Teams
Each team should show:
- profile/avatar;
- current official roster;
- active official Gameweek lineup when available;
- LIVE team/player points while active;
- finalized Gameweek/season totals when finalized;
- Trading Block context.

## Transactions
The app is the primary research/negotiation layer, not the official ownership execution engine.

Keep:
- Trading Block;
- direct trade offers and responses/counters;
- multi-player proposals where legal;
- player comparison and roster impact;
- waiver/free-agent research;
- proposal history/status.

An accepted in-app proposal does not itself change official ownership. Once a move is executed in FPL Draft, verified official ownership/transaction reads should reconcile it automatically.

## Archive
Replace Draft Archive with **Archive** containing:
- canonical custom draft history;
- completed Gameweek lineups and bench order;
- player Gameweek points;
- each team's Gameweek total;
- season total after each Gameweek;
- league position/rank movement after each Gameweek;
- standings snapshots;
- later rank-over-time and season analytics.

Persist/snapshot history where required so later upstream changes do not erase the historical view.

## Removed manual requirements
The target no longer includes:
- manual Gameweek XI submission into this app;
- manual Gameweek score entry;
- manual standings entry;
- manual current Gameweek selection;
- manual roster ownership maintenance when official ownership can be verified;
- Commissioner score correction or post-kickoff lineup replacement as a normal feature.

## Desktop/mobile
Desktop and mobile are both first-class presentations over one shared domain/data state. Live calculations, ownership, lineups and archive truth must not diverge by device.

## Non-goals
- public registration;
- enterprise auth;
- automated official FPL writes without separate explicit approval;
- scraping when official/public sources are sufficient;
- rewriting canonical custom draft history;
- copying Premier League Draft UX when we can provide a better companion experience.
