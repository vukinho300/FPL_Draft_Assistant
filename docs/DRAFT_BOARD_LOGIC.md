# Draft-board logic

## Purpose

The Phase 3 domain answers two deterministic questions:

1. How many players at each position must a league draft?
2. Which normalized players belong on a buffered candidate board when ordering is based only on official Draft rank?

The implementation consumes project-owned `Player[]`. It does not import upstream FPL response structures or React.

## Official FPL Draft rules

One manager's 15-player squad contains:

| Position | Players |
| --- | ---: |
| GK | 2 |
| DEF | 5 |
| MID | 5 |
| FWD | 3 |
| Total | 15 |

These values are represented once in `ROSTER_REQUIREMENTS`. They are official roster rules, not project heuristics.

The application supports league sizes from 2 through 16 managers. Domain validation rejects sizes outside that range and non-integer values.

## Verified upstream data

`Player.officialDraftRank` comes from the normalized upstream `elements[].draft_rank` field documented in [FPL_DATA_CONTRACT.md](FPL_DATA_CONTRACT.md). A lower non-null ordinal sorts first.

The rank's methodology remains controlled and undocumented by the upstream service. This project does not reinterpret it as points, a projection, or an internally calculated player-quality score.

## Project calculations

For manager count `N`, positional demand is:

```text
GK  = N × 2
DEF = N × 5
MID = N × 5
FWD = N × 3
```

Candidate targets are calculated separately for every position:

```text
positionCandidateTarget = ceil(positionDemand × (1 + 0.35))
```

Verified examples:

| Managers | Demand GK/DEF/MID/FWD | Demand total | Targets GK/DEF/MID/FWD | Board total |
| ---: | --- | ---: | --- | ---: |
| 2 | 4 / 10 / 10 / 6 | 30 | 6 / 14 / 14 / 9 | 43 |
| 6 | 12 / 30 / 30 / 18 | 90 | 17 / 41 / 41 / 25 | 124 |
| 8 | 16 / 40 / 40 / 24 | 120 | 22 / 54 / 54 / 33 | 163 |
| 16 | 32 / 80 / 80 / 48 | 240 | 44 / 108 / 108 / 65 | 325 |

For each player, `positionRank` is their one-based place among players at the same position under the deterministic ordering below. `insideCoreDemand` is true when `positionRank <= positionDemand`.

These values are project calculations derived from official roster rules and normalized rank. They are not additional official Premier League fields.

## Project heuristic

`DEFAULT_RESERVE_BUFFER = 0.35` is the only player-pool heuristic in Phase 3. It adds reserve choices beyond the exact number of roster slots.

The buffer is applied per position because applying 35% only to the overall 15-player demand could allocate too many reserve candidates to one position and too few to another. Independent rounding guarantees each positional pool has its own intended reserve depth. The value 0.35 is a transparent project choice, not an FPL rule.

## Deterministic ranking

Players are ordered by this exact sequence:

1. non-null `officialDraftRank`, ascending;
2. null rank after every non-null rank;
3. display name ascending by JavaScript string code-unit comparison;
4. player ID ascending by the same comparison.

Name and ID are applied to both duplicate official ranks and null ranks. Input array order is never a tie-breaker, and sorting does not mutate the supplied array. Null is retained and never converted into a fabricated official rank.

## Candidate-board construction

`buildDraftBoard` performs these steps:

1. validate league size;
2. calculate league demand and per-position candidate targets;
3. sort all players with the deterministic comparator;
4. assign each player a same-position rank;
5. verify every position has at least its target count;
6. retain players whose position rank is within that position's target;
7. attach demand, target, position rank, and core-demand context;
8. return the combined entries in the same global official-rank-based order.

If any position is undersupplied, `InsufficientCandidatePlayersError` identifies the position, required candidate count, and available player count. The domain does not silently claim that an incomplete board met its target.

## Explicit non-features and limitations

- No projected points
- No VOR or numerical scarcity score
- No AI recommendations
- No hidden or weighted player-quality formula
- No position or club multiplier
- No injury or availability interpretation
- No guarantee that an officially ranked player is healthy, available, or starting
- No live draft picks, roster state, or manager order

Availability remains omitted because Phase 2 did not establish the semantics of upstream status codes.
