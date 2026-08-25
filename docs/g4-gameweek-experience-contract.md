# G4 My Team and Teams Gameweek contract

G4 joins the existing normalized global player catalogue to official league ownership and
the shared G3 lineup/scoring snapshot by exact official player ID. Current ownership is the
current-roster authority. The immutable custom draft remains historical evidence only.

## Mode resolution

- When the normalized current event is `UPCOMING` and its deadline is in the future, My Team
  exposes the private decision workspace for that event.
- When the official API retains a football-complete/marked-finished event and exposes a next
  event whose deadline is in the future, My Team plans for that explicit next event. It does
  not present the completed event's XI as the upcoming lineup.
- At or after the current event deadline, the verified current entry/event lineup is the
  read-only official lineup.
- If a next-event deadline has passed while the official API still exposes only the previous
  event lineup, the experience is unavailable. It never substitutes the previous XI.

The deadline, not first fixture kickoff, is the lock boundary. This uses the strongest
verified official signal without inventing behavior for the unobserved deadline-to-kickoff
window.

## Planner and official state

The decision workspace begins with a valid 4-4-2 arrangement from the current official
15-player roster. Users can test swaps subject to one goalkeeper, 3-5 defenders, 2-5
midfielders, 1-3 forwards, and a goalkeeper-first bench. This is ephemeral React state for
the current authenticated account/event/roster fingerprint. It is not stored in localStorage
or Supabase, is not shared on Teams, and is never submitted to FPL.

Official mode displays G3's effective positions 1-11, ordered positions 12-15, selection
multiplier, official live player points, and shared live team score. React does not recalculate
the team score. Pitch and List are two presentations over the same enriched model.

The response retains source `retrievedAt` and `staleAfterMs`; the shared G3 controller derives
current freshness at consumption time. A failed refresh may retain last verified data, but
the UI labels stale/error state and never resets its source timestamp.
