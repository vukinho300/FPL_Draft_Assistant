# Fantacalcio — Product and League Rules

## Product objective

Create a live auction assistant that records the real asta quickly and continuously evaluates Vuk's buying power, roster construction and alternatives.

It is not a snake draft.

## Manager configuration

Initial managers:
1. Achi
2. Massi
3. Gian
4. Francesco
5. Vuk
6. Dan
7. No Name
8. No Name 2

Architecture must allow adding/removing managers, including a likely 10-manager configuration.

Initial budget:
- 500 credits per manager;
- configurable, not a permanent hardcoded constant.

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

## Position sequence

Supported modes:
- standard: POR → DIF → CEN → ATT;
- inverted: ATT → CEN → DIF → POR;
- custom: any user-defined sequence.

The UI should explain POR/DIF/CEN/ATT in readable language.

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

## Exact rules still required before valuation work

FA0 must confirm:
- Classic vs Mantra;
- exact squad slots by position;
- official role source;
- vote/fantavote source;
- bonus/malus rules;
- goalkeeper rules;
- clean-sheet rules;
- penalties;
- defense/captain/other modifiers;
- allowed formations if relevant;
- minimum bid;
- bid increment rules;
- reserve/minimum-credit rule for unfilled slots;
- unsold-player behavior;
- whether any special league-specific rules affect expected player value.

These rules are model inputs. Do not train or price against a generic Fantacalcio scoring regime when the real league differs.

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
