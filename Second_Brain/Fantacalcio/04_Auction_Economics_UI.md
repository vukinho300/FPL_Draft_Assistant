# Fantacalcio — Auction Economics and Desktop UI

## Core economic objective

Optimize Vuk's final roster under:
- remaining credits;
- remaining required slots;
- available players;
- projected remaining-season value;
- expected market prices;
- opponent budgets;
- opponent positional needs;
- scarcity;
- auction inflation;
- uncertainty/risk.

The system is not merely a best-player list.

## Player economics

Distinguish:
- football/Fantacalcio projection;
- replacement-level value;
- scarcity-adjusted value;
- expected auction price;
- fair price;
- risk-adjusted value;
- maximum legal bid;
- recommended maximum bid.

Maximum legal bid is an exact budget constraint:

```text
remaining credits
- minimum credits required to fill every other mandatory slot
```

Recommended maximum bid is strategic and dynamic: the price above which buying now is worse than preserving budget for plausible remaining alternatives/scenarios.

## Pre-auction budget allocation

Do not hardcode generic position percentages as strategy.

Use the validated player pool, league size, squad constraints, expected prices and replacement levels to derive an optimized budget allocation.

Integer/mixed-integer optimization and later Monte Carlo/stochastic simulation are candidates.

## Opponent budgets

After every purchase, derive for every manager:
- remaining budget;
- remaining slots by position;
- maximum legal bid;
- buying power;
- likely positional competition.

Financial constraints are hard evidence; opponent psychology is optional/uncertain and must never be treated as fact.

## Inflation

Estimate market inflation/deflation relative to expected prices, ideally controlling for:
- position;
- player tier;
- auction phase.

Shrink early estimates toward neutral when sample size is small.

Display confidence/sample context with inflation values.

## Auction state engine

Prefer an event ledger:
- nomination;
- sale;
- correction;
- void/undo where needed.

Derived state:
- budgets;
- squads;
- available players;
- slots;
- position spend;
- market residuals;
- optimization inputs.

Avoid silent destructive edits that make budget history impossible to audit.

## Laptop-first UI

Blue visual identity distinct from FPL green.

Conceptual layout:
- left: player search/rankings/filters;
- center: current nomination, bid/fair/max guidance, sale controls;
- right: all manager budgets/slots/buying power;
- lower/secondary area: history, targets, alternatives, inflation and warnings.

Keyboard-first entry is a priority.

Potential shortcuts should be researched/tested rather than assumed, but common actions should require very few clicks/keystrokes.

## Reliability

For the real asta:
- sale recording must be fast;
- duplicate ownership must be impossible;
- budgets must update transactionally;
- corrections must be obvious;
- backup/export should be available;
- auction state should not depend on an external model refresh during the session;
- run against a frozen/known projection release.
