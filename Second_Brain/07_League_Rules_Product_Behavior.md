# League Rules and Product Behavior

## League
Name: Kile N Others
Season: 2026/27
Managers: 6

Jakin Goff is the `LEAGUE_OWNER` account and is displayed as **Commissioner**. Commissioner is an account/league role, not authority to rewrite official FPL Draft lineups or scores.

## Canonical custom draft
The repository's 2026/27 90-pick custom draft is immutable historical truth.

The league used a custom draft process and later entered those picks into the Premier League Draft platform. Therefore platform draft choices do not replace the custom draft archive.

## Live season state
For in-season factual state, prefer verified official FPL Draft reads over manual duplication.

Target official live authority includes:
- current Gameweek/timing;
- official entry Gameweek lineup;
- current ownership/free-agent state;
- live player Gameweek points/events;
- finalized Gameweek/season totals;
- official ownership changes/transactions where verified.

## League page
The League page is Gameweek-first.

During an active Gameweek it should prioritize:
- current Gameweek;
- authenticated manager's LIVE points;
- LIVE/provisional standings;
- rank movement and points gaps;
- important verified football events affecting league teams;
- official ownership/waiver/trade changes;
- recent league transactions;
- data freshness.

The live table should update as soon as the verified official live feed changes, rather than waiting for the Premier League Draft standings page to finalize its daily results.

LIVE/provisional values must be labeled as such. Finalized official totals/standings replace provisional calculations after reconciliation.

## My Team — inactive Gameweek
When the Gameweek is not active, My Team is a lineup tester / decision workspace.

Managers should be able to experiment with possible XI/bench combinations without pretending to submit anything to official FPL Draft.

Target decision support includes:
- current official roster;
- experimental XI and ordered bench;
- formation derived from chosen XI;
- fixtures;
- form and points;
- availability/injury evidence;
- player stats/detail modal;
- later starting-likelihood classification and recommendations.

Planner state may persist across devices but remains non-authoritative project state.

## My Team — active Gameweek
Once the Gameweek is active:
- automatically load the verified official FPL Draft lineup for the authenticated entry;
- show LIVE team points above the lineup;
- show live points for each player in formation/list views;
- preserve official XI/bench semantics from the verified entry/event contract;
- update automatically as official live player data changes;
- do not ask the manager to manually submit or re-enter the lineup.

## Teams
Teams uses the same normalized official/live state as My Team for all six managers.

During an active Gameweek each team should show:
- profile/team identity;
- official XI/bench;
- LIVE team points;
- live player points;
- live event indicators;
- formation/list presentations.

Outside active play it can emphasize current official roster, profile and finalized historical context.

## Formation and bench
Formation remains derived from the starting XI and must satisfy valid FPL lineup constraints.

The bench is ordered meaningful data. Exact official entry/event semantics must be verified before production use.

## Live scoring and standings
During active play, project-calculated values are allowed only when built entirely from verified official inputs and clearly labeled LIVE/provisional.

Target live table formula:
- last finalized season baseline;
- plus current verified live Gameweek team total for each manager;
- rank all six continuously;
- expose rank movement and points gaps.

Do not wait for delayed official standings if the official live inputs are already sufficient to calculate the league table safely.

Autosub, bonus, captain-equivalent or any other semantics must never be assumed; verify the Draft contract/scoring behavior first.

## Finalized score provenance
Preferred provenance:
1. LIVE/provisional project calculation from verified official inputs while the Gameweek is active.
2. Official finalized FPL Draft Gameweek/season result once finalized.
3. Unavailable if a required verified source is missing.

The target no longer includes manual score entry or Commissioner score corrections.

## Important events
The League feed should show league-relevant verified events rather than generic football noise.

Examples:
- goal / assist / card / goalkeeper penalty save for a player owned by one of the six teams;
- meaningful resulting rank movement;
- verified waiver/free-agent/trade ownership change;
- other important scoring events only when supported by verified official data.

Example presentation concept:
`Saka goal · Jakin Goff +5 · LIVE 3rd → 2nd`

## Current ownership
After the ownership contract is verified, official FPL Draft ownership is current live roster authority.

The custom draft remains immutable historical starting state.

Free Agent/Owned filters and team current rosters should eventually use verified official ownership rather than manual project roster maintenance.

## Trading Block and proposals
The app should improve the trade/waiver experience rather than copy FPL Draft.

Trading Block:
- owner may list/unlist only their own currently owned players;
- listing is visible to the league;
- listing does not change official ownership.

Trade proposals:
- support one/multiple players where positional legality permits;
- allow accept/reject/withdraw/counter-style workflow where implemented;
- provide strong comparison/research context;
- accepted proposal means agreement inside this app only;
- official ownership changes only when the move is actually executed in FPL Draft;
- verified official state should later reconcile the proposal as completed/processed automatically.

## Waiver research
Transactions should eventually provide a dedicated waiver/free-agent research experience using verified available-player state plus form, points, fixtures, minutes, availability, usage, rankings and later recommendations.

## Archive
Rename/evolve Draft Archive into **Archive**.

Archive contains:
- canonical custom Draft history;
- completed Gameweek official lineups/bench;
- player points for that Gameweek;
- team Gameweek totals;
- season totals after the Gameweek;
- league position/rank movement after the Gameweek;
- final standings snapshot;
- later season progression and manager analytics.

Historical snapshots should be preserved when required so later upstream changes do not alter old Gameweek views.

## Player photos
Lineup/bench presentation should eventually use verified official Premier League player photos. Never guess CDN URLs or identity mappings.

## Removed/superseded product rules
The target no longer includes:
- manual project Gameweek lineup submission;
- member lineup-write locks because the official lineup is read rather than submitted here;
- Commissioner post-kickoff lineup editing;
- manual Gameweek score correction;
- manually maintained current ownership when official ownership is available;
- automatically generated fake submitted lineup fallback.

Before official lineup data is available, show truthful unavailable/not-yet-connected states rather than fabricate a submission.

## Mobile navigation
Primary mobile navigation remains League, My Team, Teams, More. Archive replaces Draft Archive in the long-term navigation label.

Phone use must remain vertical, touch-friendly, safe-area aware and usable without required zoom.
