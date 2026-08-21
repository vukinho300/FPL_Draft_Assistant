# League Rules and Product Behavior

## League
Name: Kile N Others
Season: 2026/27
Managers: 6

Original manager identities:
1. Vuk
2. Diego
3. Kristian
4. Miku/Lovro
5. Tin
6. Deni

Visible team-account names are documented in `01_Project_Purpose_Requirements.md`.

## Squad contract
Per manager:
- GK 2
- DEF 5
- MID 5
- FWD 3
- Total 15

Current official draft contains 90 unique players and six complete legal rosters.

## Draft history
The 2026/27 official draft is immutable historical truth. Later roster changes must be represented as transactions layered after the draft.

## Mobile navigation product rule
Primary mobile navigation order:
1. League
2. My Team
3. Teams
4. More

More contains the remaining destinations, including:
- Players
- Matchday
- Transactions
- Draft Archive

The mobile bottom navigation should feel like a polished sports app: floating/rounded, safe-area aware, touch-friendly, visually animated, and never clipped by the viewport. The page itself must remain fixed to the phone width with vertical scrolling only and no required zooming for normal use.

## League home page priority
The League page is a Gameweek-first dashboard, not a draft-summary page.

Prominent content should prioritize:
- league name `Kile N Others` as the main heading;
- current Gameweek context;
- the logged-in manager's current Gameweek points;
- league standings;
- important verified football/Gameweek events;
- recent league transactions lower on the page.

Do not spend primary League-page space on:
- manager count;
- complete-squad count;
- official-draft pick count;
- roster completeness;
- large Draft Archive calls to action;
- draft-history activity.

Draft-focused summary information belongs in Draft Archive or other secondary contexts.

Until standings, Gameweek points or event sources are verified, the UI must show truthful unavailable states rather than fabricated values.

## Gameweek lineup
Managers should be able to:
- experiment with possible XI/bench without submitting;
- submit an actual Gameweek lineup;
- see only their own editing controls.

A submitted lineup must record enough information to reconstruct that Gameweek without later roster/UI changes altering history.

The authoritative Gameweek lineup is shared persistent application data. Mobile and desktop are two presentations of the same lineup record. A lineup submitted on one device must be visible on the other after reading the shared backend state.

Do not use mobile-only or desktop-only authoritative lineup state, and do not use localStorage as the source of truth for submitted lineups.

### Starting XI and formation
The starting XI contains exactly 11 players and must satisfy valid FPL lineup constraints.

Formation is derived from the selected starters, not chosen independently for presentation.

Example:
- 3 DEF + 5 MID + 2 FWD => 3-5-2
- replacing one FWD starter with one DEF starter => 4 DEF + 5 MID + 1 FWD => 4-5-1

Formation validity belongs in shared domain logic, not only in mobile/desktop UI components.

### Bench
The bench is ordered and meaningful Gameweek data:
- substitute goalkeeper;
- outfield substitute 1;
- outfield substitute 2;
- outfield substitute 3.

My Team should eventually present a football-pitch XI with a separate bench directly underneath. Teams should reuse the same lineup rendering model but without edit controls for other managers.

### Missing submission and automatic fallback
If a manager does not submit an official project lineup for the Gameweek:
- do not reuse the previous Gameweek lineup;
- preserve submission state as missing/unsubmitted;
- the Teams view may display an automatically selected valid XI and bench for readability;
- the fallback must be clearly labeled as automatically generated / not submitted;
- the fallback is display-only and must not be treated as the official submitted lineup;
- project-calculated lineup points for that fallback are zero.

A verified official FPL total may still be shown where the score provenance contract allows it.

## Gameweek score provenance
Preferred precedence for the displayed league total:
1. Admin correction, if one exists.
2. Verified official FPL Draft total.
3. Project-calculated total from a valid submitted lineup.
4. Unavailable.

Automatically generated fallback lineups are not eligible for project-calculated lineup points.

Always expose provenance where useful:
- Official FPL
- Project calculated
- Admin corrected
- Unavailable

Admin correction must not erase the underlying original/calculated value.

## Gameweek event feed
The League page's important-event feed should represent verified football/Gameweek events rather than draft history.

Examples include:
- goals;
- assists;
- goalkeeper penalty saves;
- hat tricks;
- other genuinely important scoring events when supported by verified data.

Do not fabricate event records before a verified player/Gameweek data source exists.

## Admin corrections
Jakin Goff / LEAGUE_OWNER can correct another team's points after a Gameweek.

Correction records should retain:
- target team/gameweek;
- old/source value where available;
- corrected value;
- admin identity;
- reason/note;
- timestamp.

## My Team presentation
The long-term My Team target is a Fantacalcio-style football lineup presentation adapted to this product:
- green pitch;
- 11 starters positioned by derived formation;
- verified Premier League player photos when the mapping contract exists;
- readable player names;
- separate ordered bench underneath;
- mobile and desktop may render differently but consume the same lineup entity.

Do not imply a role-grouped 15-man squad is a submitted Gameweek XI.

## Teams page
Each team eventually shows:
- profile photo;
- team name;
- total points;
- Gameweek points where available;
- current squad;
- actual submitted lineup where one exists;
- automatically generated display fallback when no lineup was submitted;
- Trading Block players.

The Teams Gameweek view should reuse the same lineup renderer/model as My Team while removing edit permissions for other managers.

Avoid roster-administration clutter such as 15/15 and per-position roster-capacity counts in the Gameweek lineup presentation.

Never imply a pitch-grouped 15-man squad is the submitted Gameweek XI.

## Player photos
Starting XI and bench presentations should eventually use verified official Premier League player photos.

Do not guess CDN URLs, image identifiers or identity mappings. Use the approved Premier League photo identity research/mapping contract before production implementation. A neutral fallback silhouette is acceptable until that mapping is verified.

## Trading Block
A manager can list/unlist only their own currently owned players.

Trading Block entries are league-visible and can be surfaced on:
- My Team
- Teams
- Transactions
- player detail/context

A listing does not change ownership and does not require the owner to accept any offer.

## Trade proposals
Support one or multiple players on each side where league positional legality permits.

The existing project transaction status vocabulary is preserved:
- PROPOSED
- ACCEPTED
- REJECTED
- WITHDRAWN
- INVALID
- VETOED
- EXPIRED
- PROCESSED

Important distinction:
- ACCEPTED = participants agreed in this app.
- PROCESSED = roster ownership is actually changed in project state after approved reconciliation/confirmation.

Do not mutate current rosters on PROPOSED or merely ACCEPTED trades.

## Positional trade rule
The exchanged positional composition must match in both directions.

Examples:
- MID for MID -> legal.
- MID + FWD for MID + FWD -> legal.
- MID + MID for MID + FWD -> illegal.

Waiver/free-agent replacement must preserve position under the current project contract.

## Trade visibility
Recommended default:
- Trading Block: entire league.
- Pending proposal: participants + league owner.
- Processed transaction history: entire league.

## Player comparison
Trade comparison should reuse a shared player-data model, not duplicate its own football-stat pipeline.

Target comparison fields when reliable:
- photo
- position
- club
- points
- recent performance
- minutes/starts
- availability/injury
- usage/starter classification
- official rank
- MVP rank
- model rank

Unknown data must display as unknown/unavailable, not be guessed.

## Current vs official FPL state
The companion app must not silently diverge from real FPL Draft ownership. Future real-league reconciliation should explicitly classify mismatches before updating project state.
