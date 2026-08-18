# Kile N Others League Dashboard Roadmap

The immutable 2026/27 official draft is the base state. Roadmap work must add verified season data or processed project transactions without rewriting the original 90 picks.

## Priority A

1. League standings
2. Live Gameweek points
3. Gameweek team and bench view
4. Injury and availability centre
5. Fixture difficulty and next opponent
6. Free-agent board
7. Waiver assistant
8. Transaction history

## Priority B

9. Trade analyzer
10. Start/bench assistant
11. Weekly Vuk recommendations
12. League-wide player ownership search
13. Draft value versus current performance
14. Manager transaction performance
15. Best and worst original draft picks

## Priority C

16. Notifications
17. Long-term manager analytics
18. Season archive

## Required evidence gates

- Confirm the real league ID and six official entry IDs without authentication workarounds.
- Record and validate each FPL Draft endpoint response as `unknown` inside an adapter.
- Keep official lineups separate from project squad presentation.
- Treat availability and injury codes as unverified until their semantics are documented.
- Apply only `PROCESSED` project transactions to current roster state.
- Preserve the official draft JSON and human archive unchanged; schema changes require an explicit versioned migration and tests.
