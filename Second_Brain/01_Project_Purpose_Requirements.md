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

Jakin Goff is the league owner/admin account. Its product-facing league label is **Commissioner**. The backend authorization role remains `LEAGUE_OWNER`; `Commissioner` is the user-facing title for that privileged league role.

Login UX should remain deliberately simple: **team name + password**.

## Product priorities
1. Preserve the useful existing Draft Assistant and immutable official draft.
2. Deploy the current app to Vercel.
3. Preserve a strong desktop experience and add an intentionally designed mobile experience for the same application.
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
- Submit Gameweek lineup before the Gameweek deadline.
- Status, fixtures, useful stats and rankings.
- Later start/bench decision support.

Before a Gameweek starts, each manager may create, edit and submit only their own lineup. After the Gameweek starts, normal members can no longer insert, edit or replace lineups. The Jakin Goff Commissioner account may insert or correct a lineup for itself or any manager after kickoff, with the action treated as privileged commissioner activity and audited when persistence is implemented.

## Players
The current Players page supports shared desktop/mobile filtering and sorting using verified current data.

Primary in-season sort options:
- Official FPL Draft Rank.
- Form.
- Total Points.
- MVP Consensus.

Draft Model Rank is preserved as project/model evidence but is not a primary Players-page sort option. Free Agent / Owned state derives from current roster ownership, not a hardcoded list.

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
- Commissioner may insert/correct a lineup after the Gameweek starts when required for league administration.
- Admin may correct another team's points after the Gameweek.
- Privileged corrections/inserts must remain distinguishable and auditable.

## Desktop and mobile
Desktop and mobile are both first-class product targets.

The product remains one application with one shared data/domain layer, but presentation can adapt by viewport.

Desktop should retain the richer wide-screen experience: sidebar/navigation, spacious pitch views, tables, comparisons and dense league information.

Mobile should be intentionally designed for phone use: compact navigation, stacked cards, touch-friendly controls, readable pitch/squad views and safe handling of wide tables.

Mobile work must not replace, downgrade or remove the desktop version. New user-facing features should normally be considered complete only when usable on both desktop and mobile unless a temporary exception is explicitly documented.

## Non-goals for the near-term foundation
- Enterprise authentication.
- Public user registration.
- Automated official FPL transactions.
- Scraping when a reliable official/public source already exists.
- Large model-research work before the season dashboard foundations are complete.
- Rewriting the immutable draft history.