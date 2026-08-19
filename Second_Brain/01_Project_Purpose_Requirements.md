# Project Purpose and Requirements

## Product direction
The project has evolved from a private drafting tool for Vuk into a private league-wide companion for the six-team FPL Draft league **Kile N Others**.

It must preserve the original Draft Assistant's useful functionality while adding persistent league features, account-aware pages, Matchday tracking, richer player information, and trade workflows.

## League accounts
Exactly six normal team accounts initially:
- Vuk -> Jakin Goff
- Kristian -> Dindi
- Diego -> 22nd oBlock
- Lovro -> Miku007
- Deni -> Rod Wave Disciples
- Tin -> Tintilinic

Jakin Goff is the league owner/admin account.

Login UX should remain deliberately simple: **team name + password**.

## Product priorities
1. Preserve the useful existing Draft Assistant and immutable official draft.
2. Deploy the current app to Vercel.
3. Make it properly usable on mobile.
4. Add persistent league data.
5. Add the six accounts and enforce authorization/RLS.
6. Make My Team and other pages account-aware.
7. Add Gameweek tracking and league points.
8. Improve player information/photos/sorting.
9. Add Trading Block and direct trade proposals.
10. Add later recommendation/analytics features only after reliable data foundations exist.

## Required league pages
Target navigation remains conceptually:
- League
- My Team
- Teams
- Matchday
- Players
- Transactions
- Draft Archive

The useful legacy Draft Room code remains preserved even if it is not part of the default season navigation.

## Teams
Each team should eventually expose:
- Team name.
- Team profile photo.
- Current total points.
- Current Gameweek points where available.
- Current 15-player squad.
- Submitted Gameweek starting XI/bench when actually submitted.
- Trading Block players.

Never display an invented historical lineup when a manager failed to submit one.

## My Team
Account-specific page for the logged-in manager:
- Current squad.
- Player photos.
- Starting XI / bench experimentation.
- Submit Gameweek lineup.
- Status, fixtures, useful stats and rankings.
- Later start/bench decision support.

## Players
Must retain existing ranking evidence and support clear filtering/sorting for:
- Official Draft rank.
- MVP/Draft rank.
- Model rank.
- Free agents.
- All players.
- Position and search.

## Transactions
Target capability:
- Trading Block.
- Direct trade proposals between managers.
- Multi-player proposals where positional rules permit.
- Player comparison before sending/accepting.
- Clear proposal states.
- Trade/waiver/free-agent history.
- No automatic official-FPL mutation until reconciliation/authorization design is explicitly approved.

## Gameweek history
The site must survive missing manager submissions.
- Missing lineup -> lineup remains unavailable.
- Do not reuse/invent a previous lineup.
- Official team total may still be displayed if verified from FPL Draft.
- Project-calculated totals require a submitted lineup.
- Admin may correct another team's points after the Gameweek.
- Corrections must remain distinguishable and auditable.

## Mobile
Desktop and mobile are first-class targets for the season dashboard. Mobile work should adapt the current UI rather than redesigning the whole product.

## Non-goals for the near-term foundation
- Enterprise authentication.
- Public user registration.
- Automated official FPL transactions.
- Scraping when a reliable official/public source already exists.
- Large model-research work before the season dashboard foundations are complete.
- Rewriting the immutable draft history.