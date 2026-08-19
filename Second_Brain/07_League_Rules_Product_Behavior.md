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

## Gameweek lineup
Managers should be able to:
- experiment with possible XI/bench without submitting;
- submit an actual Gameweek lineup;
- see only their own editing controls.

A submitted lineup must record enough information to reconstruct that Gameweek without later roster/UI changes altering history.

If no lineup was submitted:
- do not invent one;
- do not reuse the previous Gameweek lineup;
- display lineup as unavailable;
- still allow an official total to be shown if a verified official source provides it.

## Gameweek score provenance
Preferred precedence for the displayed league total:
1. Admin correction, if one exists.
2. Verified official FPL Draft total.
3. Project-calculated total from a submitted lineup.
4. Unavailable.

Always expose provenance where useful:
- Official FPL
- Project calculated
- Admin corrected
- Unavailable

Admin correction must not erase the underlying original/calculated value.

## Admin corrections
Jakin Goff / LEAGUE_OWNER can correct another team's points after a Gameweek.

Correction records should retain:
- target team/gameweek;
- old/source value where available;
- corrected value;
- admin identity;
- reason/note;
- timestamp.

## Teams page
Each team eventually shows:
- profile photo;
- team name;
- total points;
- Gameweek points where available;
- current squad;
- actual submitted lineup where one exists;
- Trading Block players.

Never imply a pitch-grouped 15-man squad is the submitted Gameweek XI.

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