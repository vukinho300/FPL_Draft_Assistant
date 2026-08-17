# Draft-night MVP

## Purpose and boundary

Phase 6 is a desktop-first companion for manually mirroring an official FPL Draft. The user records the football player selected on the official service; the existing snake schedule supplies the manager. The application never authenticates to FPL, changes an official league, submits a pick, or changes the official server order.

The default fixture is Vuk, Diego, Kristian, Miku, Tin, and Deni with Vuk selected as the user. These are real demo labels, not domain assumptions. The schedule and state domains remain generic for 2–16 managers.

## Live data flow

```text
draft.premierleague.com/api/bootstrap-static
        ↓
existing server-side FPL client + strict normalizer
        ↓
GET /api/fpl
        ↓
normalized Player[]
        ↓
ranking, pick state, rosters, recommendations
        ↓
React Draft Room
```

Production and local development both use `/api/fpl`; React does not call the upstream endpoint directly. The visible board includes player, club, position, official Draft rank, project MVP rank, and optional model rank. Loading and controlled error states do not discard the saved session.

## Ranking evidence

Official `Player.officialDraftRank` is the live backbone. It remains a separate unchanged nullable ordinal. A null-ranked player remains valid and follows officially ranked players.

The secondary artifact uses one fixed native-FPL model:

- position-specific Ridge regression;
- `alpha = 10`;
- feature groups `FPL_BASE`, `FPL_EXPECTED`, and `FPL_ICT`;
- cold-start category as training metadata;
- no `FORM`, `TEAM_CONTEXT`, `BOOKMAKER`, Understat, ClubElo, scraping, or XGBoost.

The Phase 5 trust prerequisites are data quality **PASS WITH EXCLUSIONS**, leakage **PASS**, and model sanity **PASS**.

### Chronological development verification

No 2025/26 result was used to select or tune this fixed candidate.

| Development season | Train seasons | Samples | MAE | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2023/24 | 2021/22–2022/23 | 658 | 31.926850 | 40.921516 | 0.526270 | 0.706264 |
| 2024/25 | 2021/22–2023/24 | 616 | 30.832101 | 40.703029 | 0.591946 | 0.804703 |

The strongest simple NDCG@25 baselines were 0.698975 in 2023/24 and 0.713113 in 2024/25. The model passed the fixed MVP gate: positive useful correlation, NDCG@25 above 0.60 in both folds, and mean NDCG@25 within 0.10 of the best simple-baseline mean.

Position results are retained rather than hidden:

| Season | Position | MAE | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: |
| 2023/24 | GK | 28.750897 | 38.287542 | 0.497391 | 0.711200 |
| 2023/24 | DEF | 27.346444 | 33.168549 | 0.555429 | 0.746665 |
| 2023/24 | MID | 32.437500 | 42.140833 | 0.560087 | 0.764780 |
| 2023/24 | FWD | 44.494207 | 54.460453 | 0.306879 | 0.587774 |
| 2024/25 | GK | 27.295135 | 41.815559 | 0.517708 | 0.760447 |
| 2024/25 | DEF | 27.810533 | 35.462705 | 0.542677 | 0.724572 |
| 2024/25 | MID | 31.573167 | 41.316516 | 0.645072 | 0.790277 |
| 2024/25 | FWD | 39.878348 | 50.169502 | 0.575684 | 0.761402 |

The mixed 2023/24 FWD result is one reason the model remains secondary rather than becoming the sole ranking authority.

## Current 2026/27 artifact

`research/scripts/build_current_draft_rankings.py` first reruns the fixed development gate, then trains the same configuration on quality-approved draft-day datasets through 2025/26. It requires exact stable FPL `code` identity between a current player and 2025/26 history. Draft `id` remains the production join key only after that exact research-side match.

The generated artifact contains no model binary or historical identity key. It records provenance plus only the Draft player ID, predicted season-points signal, global model rank, position model rank, availability flag, and controlled unavailable reason.

The current generation observed:

- 590 current players;
- 460 exact historical matches and model signals;
- 130 unmatched players;
- zero ambiguous matches;
- zero identity conflicts.

No fuzzy matching is used. Missing historical data does not mean poor quality. Unmatched or insufficient-history players keep the official ranking backbone and display the historical model signal as unavailable.

## DraftFitHeuristicV1

For an officially ranked player with a trustworthy model signal:

```text
consensusScore = 0.70 × officialRankPercentileScore
               + 0.30 × modelRankPercentileScore
```

Without a trustworthy model signal:

```text
consensusScore = officialRankPercentileScore
```

Officially ranked players remain before null-ranked players. Ties use official rank, display name, then player ID. The weights are an inspectable **project MVP heuristic**. They are not official FPL values, historically optimized weights, expected points, or probabilities.

## Authoritative pick history

Every recorded pick contains:

```ts
interface DraftPick {
  overallPickNumber: number
  roundNumber: number
  managerId: string
  playerId: string
}
```

History must equal a valid prefix of the generated schedule. The schedule chooses the manager; the user chooses only the football player. From history the domain derives completed-pick count, current picker, drafted IDs, available players, and every manager roster.

Validation rejects duplicate players, unknown players, picks after completion, history/schedule mismatches, and position-capacity violations. Official roster capacities are 2 GK, 5 DEF, 5 MID, and 3 FWD. There is no price, budget, or three-per-club rule.

Undo removes only the final pick. Availability, picker, roster, and recommendations are then recomputed from the shorter authoritative prefix.

## Best Available

Best Available is the highest MVP-consensus-ranked available player who remains legal for the user's roster. It contains no scarcity adjustment.

## Turn Horizon and deterministic depletion

Best Fit calls the existing `getTurnHorizon()` domain function. Its meaningful horizon is the opponent selections after the upcoming user turn and before the following user turn. At Vuk's Picks 12 and 13, the upcoming turn is `[12, 13]`, the following turn starts at Pick 24, and the derived scenario contains 10 opponent selections.

The scenario removes the next `N` highest consensus-ranked available players after reserving the candidate under evaluation. This is explicitly a stress test:

> Under top-of-board depletion, what positional quality and depth remain?

It is not a prediction that opponents will make those selections and provides no chance, likelihood, or survival percentage.

## Best Fit heuristic

The pure algorithm:

1. removes user-roster-illegal candidates;
2. keeps a quality shortlist of `max(5, N + 5)` candidates, bounded by availability;
3. reserves each candidate and removes the next `N` top consensus options;
4. measures the candidate's position-quality drop to the best remaining option;
5. calculates `bestFitScore = consensusScore + 0.35 × positionDropoff`;
6. sorts by Best Fit score, consensus rank, display name, and player ID;
7. returns five structured recommendations and deterministic explanations.

The 0.35 drop-off multiplier and 0.10 strong-alternative band are project MVP heuristics, not learned weights. The output identifies current quality, scenario horizon, post-scenario depth, legal roster count, and reasons. It exposes no opponent probability fields.

Best Available and Best Fit may differ naturally. The algorithm does not manufacture scarcity at Pick 1.

## Persistence schema

Storage is isolated behind `src/storage/draftSessionStorage.ts`.

```text
key: fpl-draft-assistant:v1
schemaVersion: 1
persisted: ordered managers, userManagerId, pickHistory
derived: completed count, current picker, rosters, drafted IDs, availability
```

Invalid or corrupted saved data is rejected and the UI offers a fresh-session reset. There is no database, account, or cross-device synchronization.

## Known limitations and Best Pair boundary

- The Ridge signal is secondary and has meaningful cold-start and positional limitations.
- The live public endpoint is undocumented or insufficiently documented.
- Opponent depletion is deterministic scenario analysis, not behavioral modeling.
- Best Fit evaluates the current individual selection only.
- No injury diagnosis, fixture analysis, prices, budget, club cap, trades, waivers, or official FPL automation exists.
- No XGBoost, Understat production data, bookmaker production data, or scraping exists.

Because schedule, history, availability, and roster state are immutable domain inputs, a later Best Pair service can jointly evaluate consecutive picks without changing state ownership. Phase 6 does not implement that optimizer.
