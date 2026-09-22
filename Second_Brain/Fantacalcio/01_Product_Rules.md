# Fantacalcio — Product and League Rules

## Product objective

Create a live auction assistant that records the real asta quickly and continuously evaluates Vuk's buying power, roster construction and alternatives.

It is not a snake draft.

## Season and auction timing

- Season: **2026/27**.
- Initial auction must happen before **10 October 2026** and is expected to be imminent; exact date is not frozen yet.
- The model/evaluation target for the first auction is the **remaining 2026/27 season from the auction date onward**.

## Manager configuration

Initial managers:
1. Achi
2. Massi
3. Peps
4. Vuk
5. Dan
6. Paolo
7. Gian/Edu
8. Francesco

Architecture must allow adding/removing managers, including a likely 10-manager configuration.

Initial budget:
- **500 credits per manager**;
- configurable, not a permanent hardcoded constant.

## League mode and roster

- Fantacalcio mode: **Classic**.
- Competition: head-to-head league.
- Squad size: **25**.
- Required roles:
  - **3 POR**;
  - **8 DIF**;
  - **8 CEN**;
  - **6 ATT**.
- Use the Fantacalcio Classic listone/roles at auction time unless a commissioner-specific role override is explicitly confirmed.

## Formations and substitutions

Working Classic formation set:
- 3-4-3
- 3-5-2
- 4-3-3
- 4-4-2
- 4-5-1
- 5-3-2
- 5-4-1

Substitution behavior currently described by the league:
- if a starter receives no valid grade, the first eligible bench player in the same position enters.

Do not expand this into hybrid/dynamic formation-changing substitution logic unless commissioner settings prove otherwise.

## Nomination and sale flow

Managers nominate in a repeating order.

Each nomination records:
- player;
- position;
- nominating manager;
- nomination order;
- starting price.

A completed sale records:
- winning manager;
- final price;
- purchase order/time.

The winner receives the player and the final price is deducted from remaining budget.

### Minimum price and budget legality

- A player cannot be purchased for 0.
- **Minimum purchase price: 1 credit**.

Because the roster must contain 25 players and every remaining purchase costs at least 1 credit, maximum legal bid must reserve at least 1 credit for every still-unfilled slot after the current purchase.

Conceptually:

```text
max legal bid
=
remaining credits
-
number of remaining mandatory slots after this purchase
```

This is a derived legality invariant, not an optional strategy setting.

## Position sequence

Supported modes:
- standard: POR → DIF → CEN → ATT;
- inverted: ATT → CEN → DIF → POR;
- custom: any user-defined sequence.

The actual 2026/27 auction sequence is **not predetermined** and will be chosen when the asta starts.

The UI should explain POR/DIF/CEN/ATT in readable language.

## Scoring baseline

The league uses the normal Fantacalcio Classic scoring configuration except where league-specific settings are explicitly documented.

Current working player-level scoring baseline:
- goal: +3;
- assist: +1;
- yellow card: -0.5;
- red card: -1;
- missed penalty: -3;
- saved penalty: +3;
- goalkeeper goal conceded: -1;
- goalkeeper clean sheet: +1;
- no captain modifier.

If the commissioner/app settings later contradict one of these values, the actual league setting becomes authority.

## Defense modifier

Defense modifier is enabled.

Confirmed commissioner rule:
- goalkeeper **is included** in the defense modifier;
- use only the **base vote** for the goalkeeper;
- goalkeeper bonus/malus is ignored for the modifier;
- defenders are treated the same way: use base votes only, excluding bonus/malus;
- known 0.25-band progression:
  - average 6.00–6.24 → +1;
  - average 6.25–6.49 → +2;
  - commissioner stated the bands continue in 0.25 increments.

Do **not** invent an upper cap or the complete high-end table until the actual league setting is confirmed.

This modifier means defender and goalkeeper base-vote consistency can have auction value beyond ordinary individual fantapoints.

## Live auction state

Continuously derive:
- players purchased / available;
- manager spend and remaining budget;
- squad slots remaining;
- spending by position;
- average purchase price;
- maximum legal bid;
- nomination/purchase progression;
- remaining high-value players;
- auction history.

Corrections must be fast and auditable. Prefer event/ledger semantics over destructive silent edits.

## Post-auction / repair market rules

Confirmed/working rules:
- purchases are final after the initial auction, aside from administrative corrections;
- trades are allowed after the auction;
- one repair auction is planned after the winter transfer market closes in 2027;
- if a player leaves Serie A, the working league rule is a **100% credit refund**;
- voluntary release returns **50% of the purchase price**.

### Injury refund

Season-ending injury refund is **not confirmed**.

Vuk believes the league likely returns 100% of the purchase price for a player documented out for the rest of the season, but this must remain an uncertainty until commissioner confirmation.

Do not encode the injury refund as a hard auction/economic rule yet.

## Live rule uncertainty still open

The following do not block the initial shell/ledger architecture but remain explicit:
- exact full defense-modifier band table/cap;
- season-ending injury refund;
- exact auction position sequence chosen at the start of the asta;
- any commissioner override to otherwise-standard Fantacalcio scoring or listone roles.

## First-version UX

Laptop/desktop only.

Priorities:
- keyboard-friendly;
- minimal clicks;
- rapid player search;
- rapid sale confirmation;
- visible budgets and roster slots;
- visible fair/max-bid guidance;
- easy correction/undo;
- no modal-heavy workflow for ordinary sales.

Mobile support is deferred.
