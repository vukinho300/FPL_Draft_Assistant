# G3 live scoring and standings contract

G3 derives one shared Kile N Others snapshot from the normalized G1/G2 contracts. It does
not persist or mutate official FPL Draft state.

## Score and identity

For each of the six verified G1 entries:

```text
live Gameweek score = sum(starter live total_points * official selection multiplier)
```

Only official lineup positions 1–11 count. Bench positions 12–15 remain available in the
team-score contract but do not contribute. Non-empty substitution data is rejected until
its semantics are observed. Missing/duplicate entries, players, lineups, or contradictory
Gameweek IDs fail the entire comparative snapshot rather than silently assigning zero or
another manager's data.

## Season baseline and rankings

GW1 has an exact season-start baseline of zero. No completed 2026/27 transition has yet
proved which official facts form a reconciliation-safe prior-season baseline for later
Gameweeks. For event 2+, G3 therefore still exposes the six verified live Gameweek scores,
but returns season standings as unavailable with
`PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED`. Previous-event entry history is
accepted only as candidate evidence when explicitly supplied and is not silently promoted
to finalized authority. The active refresh does not repeatedly fetch history that it cannot
yet use authoritatively.

Available standings use competition ranking: equal totals share a rank and the following
rank is skipped (`1, 1, 3`). Rows are serialized deterministically by official entry ID
inside a tie, but that order is not represented as a tie winner. Gaps target the nearest
strictly higher/lower score, avoiding an invented ordering inside a tie.

Official league-details event/season totals remain comparison evidence. Equality is exposed
as `valuesCurrentlyMatch`; it never means finalized. Every calculated snapshot remains
`PROVISIONAL` with reconciliation `NOT_PROVEN`, including when
`current_event_finished` is true.

## Refresh boundary

`GET /api/fpl-league-live` performs one server-side normalized refresh for all six entries.
The browser consumes only that project-owned response. Shared CDN caching is 15 seconds
while a fixture is live, 60 seconds during an active event between live fixtures, and five
minutes otherwise. The client controller requests every 30 seconds during live football,
two minutes during active quiet periods, five minutes during post-football processing, and
15 minutes before play. It exposes loading/refreshing/error/last-success state and rejects
out-of-order responses so stale requests cannot overwrite newer data.

The serialized response carries only the durable upstream retrieval timestamp and stale
threshold. Browser/controller state derives current age and `FRESH`/`STALE` from its own
clock whenever state is read; cached response bodies therefore cannot freeze freshness at
origin-generation time. Browser receipt time remains separately available as the last
successful refresh time and never replaces the upstream timestamp.

The active cadence is a maintainable polling choice, not a claim about exact upstream event
latency. `npm run verify:fpl-live-standings` checks the current read-only official state.
