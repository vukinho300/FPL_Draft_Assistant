# G2 official league-state contract evidence

Observed against the public 2026/27 FPL Draft API for Kile N Others league `45938` on
2026-08-24. This is contract evidence, not a persisted copy of live league state. Re-run
`npm run verify:fpl-league-state-live` to validate the current response.

## Current Gameweek and finalization

- `GET /api/game` returned current event `1`, next event `2`,
  `current_event_finished: false`, `processing_status: "n"`, and waiver/trade phase flags.
- Draft bootstrap `events.data` supplies event name plus lineup, waiver, and trade deadlines.
  Event 1's lineup deadline was `2026-08-21T17:30:00Z`.
- `GET /api/pl/event-status` supplies per-day `points`, `bonus_added`, and
  `leagues_updated`. The deployed official Draft client asset `index-Dgm5Kj4Q.js` labels
  point codes `l`, `p`, and `r` as Live, Provisional, and Confirmed; an empty code has no
  point status. The live response
  contained Provisional rows for completed match days and an empty row for the upcoming
  final match day.
- The normalized phase uses official flags only: no started fixtures is `UPCOMING`; any
  started but not football-complete fixture set is `ACTIVE`; all fixtures football-complete
  while `current_event_finished` is false is `AWAITING_FINALIZATION`; and
  `current_event_finished` is `FINALIZED`.
- Only the active state was observed. The finished-to-finalized transition must be checked
  after the first completed 2026/27 Gameweek before choosing G3 reconciliation timing.

## Official entry lineups

`GET /api/entry/{entry}/event/1` returned exactly 15 unique players for every G1 entry.
Every response had positions exactly `1..15`:

- positions `1..11`: starting XI;
- positions `12..15`: ordered bench;
- position `12`: goalkeeper for all six entries, followed by bench slots 1, 2, and 3;
- captain and vice-captain flags: false for all 90 selections;
- multiplier: `1` for all 90 selections at observation time;
- `subs`: empty and `entry_history`: empty during the active Gameweek.

Event 2 returned HTTP 404 with `"No pick history"`, so unavailable lineups must remain an
explicit unavailable state. Non-empty `subs` and finalized `entry_history` shapes were not
observed and are not projected into the normalized lineup contract.

## Live player scoring and fixtures

`GET /api/event/1/live` returned one player record for each of the 609 current bootstrap
players. The normalized contract includes current total points, minutes, starts, goals,
assists, clean sheets, goals conceded, own goals, penalty saves/misses, yellow/red cards,
saves, bonus, BPS, defensive contribution, and dream-team state.

`GET /api/event/1/fixtures` returned ten fixtures. Its fixture stat collections exposed
goals, assists, own goals, penalty saves/misses, cards, saves, bonus, BPS, and defensive
contribution with exact player IDs and home/away attribution. Fixtures expose kickoff,
started, `finished`, `finished_provisional`, scores, and provisional-start state.

At observation time nine completed matches had `started: true`, `finished: false`, and
`finished_provisional: true`; the final match had not started. Therefore
`finished_provisional` is required for football-complete detection and `finished` alone is
insufficient. Completed fixtures reported `minutes: 0`, so that field is not treated as a
reliable elapsed-match clock.

The live response was seen behind a CDN with an `Age` value, but no real scoring event
occurred during observation. Exact upstream event-to-response latency is unproven and G3
must not promise a number until measured during live play.

## Ownership

`GET /api/league/45938/element-status` returned exactly the same 609 player IDs as the
current Draft bootstrap:

- `a`: 519 available players with null owner;
- `o`: 90 owned players;
- each of the six G1 official entry IDs owned exactly 15 players;
- no unknown owner, duplicate player, or missing player mapping;
- owner values matched `officialEntryId`, not `officialLeagueEntryId`;
- no accepted-trade or locked record was present.

The official client treats any non-empty status other than `a`/`o` as locked. The adapter
preserves that raw status code, but a live locked record has not yet been observed. Current
ownership is safe to join through G1 IDs; it never mutates the immutable custom draft
archive.

## Standings and lag

League details returned `rank`, `rank_sort`, `last_rank`, `event_total`, and season `total`.
During the active Gameweek five official `event_total` values matched the sum of the 11
live lineup players. Jakin Goff's live XI summed to 44 while league details still returned
42. This proves league-details totals/ranks can lag live player facts during active play.

No finalized 2026/27 Gameweek existed during G2 observation. G3 must use live lineup/player
inputs provisionally and only reconcile when the official current-event finished/status
signals have been observed through a completed transition.

## Transactions, trades, and Archive feasibility

- `GET /api/draft/league/45938/transactions` returned HTTP 200 with an empty
  `transactions` array.
- `GET /api/draft/league/45938/trades` returned HTTP 200 with an empty `trades` array.
- `GET /api/draft/entry/240560/transactions` returned HTTP 403 without official FPL
  authentication. No separate public league-waiver collection was exposed by the current
  official client; waiver outcomes are expected to appear in league transactions, but no
  non-empty Kile N Others record exists yet to prove that classification.
- Kile N Others therefore proves route availability, but not any non-empty record schema or
  waiver/free-agent/trade classification semantics.
- `GET /api/entry/{entry}/history` returned event score, season total, bench points,
  transfers, and rank fields for event 1 for all six entries.
- Entry/event and event-live routes accept valid historical event IDs in their URL design,
  but completed-Gameweek retention could not be observed before GW1 finalized.

G6 should not assume it can reconstruct a stable Archive indefinitely. Re-check completed
GW1 retrospectively; preserve project snapshots later if official historical lineup, live
player, or standings snapshots are missing or mutable.
