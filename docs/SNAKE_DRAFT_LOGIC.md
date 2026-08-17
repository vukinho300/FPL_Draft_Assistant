# Snake-draft logic

## Purpose

Phase 4 establishes pure schedule intelligence: who the managers are, their supplied first-round order, who the user is, every slot in a 15-round snake draft, and how far the user is from an upcoming turn. It schedules managers only. No football `Player`, selection, roster, recommendation, or persistent state participates in this module.

## Rules and terminology boundaries

### Official FPL rules used by the project

- One manager drafts a 15-player squad. The engine reuses `FPL_DRAFT_SQUAD_SIZE`; it does not duplicate that rule as an unrelated value.
- The roster composition remains 2 GK, 5 DEF, 5 MID, and 3 FWD as documented in [DRAFT_BOARD_LOGIC.md](DRAFT_BOARD_LOGIC.md).

### Project calculations

- The application accepts 2–16 configured managers.
- Odd schedule rounds use the supplied order and even rounds reverse it.
- Pick numbers, current picker, turns, and horizons are derived from the generated schedule.

### Project terminology

A **user turn** is one or more consecutive scheduled selections belonging to the user. This is project terminology, not an official FPL term.

### Real league demo data

Vuk, Diego, Kristian, Miku, Tin, and Deni are a real project test and development example. They are not hard-coded into manager validation or the snake algorithm.

## Manager model and configuration

```ts
interface Manager {
  readonly id: string
  readonly displayName: string
}

interface DraftConfiguration {
  readonly managers: readonly Manager[]
  readonly userManagerId: string
  readonly rounds: 15
}
```

The ID is project-owned and independent from `displayName`. A manager can be renamed from `Vuk` to `Vuk A.` without changing identity. No database ID or display-name-derived key is required.

The ordered manager array is the custom first-round order supplied to this companion. For example, a user may copy the result of Wheel of Names into the UI and use Move up or Move down until the visible list matches it. The assistant models that input; it does not alter the official FPL Draft server's order.

## Project validation rules

Configuration validation requires:

- an integer manager count from 2 through 16;
- every manager ID to be non-empty;
- manager IDs to be unique;
- every display name to be non-empty after trimming;
- `userManagerId` to reference one configured manager; and
- visible names to be unique after trimming and lower-case normalization.

Visible-name uniqueness is explicitly a **project UX rule, not an official FPL rule**. Two labels that look the same would make manual draft-night operation ambiguous. Configuration creation trims labels into copied, frozen manager values and never mutates the caller's array or objects.

## Snake reversal and schedule generation

Given first-round order `A B C D E F`:

```text
Round 1: A B C D E F
Round 2: F E D C B A
Round 3: A B C D E F
Round 4: F E D C B A
...
Round 15: A B C D E F
```

There are exactly 15 rounds. For `N` managers, the schedule contains `N × 15` slots: 30 for two managers, 90 for six, and 240 for sixteen.

## DraftSlot contract

Every scheduled selection is a project-owned immutable value:

```ts
interface DraftSlot {
  readonly overallPickNumber: number
  readonly roundNumber: number
  readonly pickInRound: number
  readonly managerId: string
}
```

All public numbers are one-based. Overall Pick 1 is Round 1, Pick in Round 1. Zero-based array offsets remain an implementation detail.

`getDraftSlot(schedule, overallPickNumber)` rejects non-integers and values outside `1..schedule.length`; it never clamps them.

## Completed-pick and current-picker semantics

`completedPickCount` describes the length of the completed schedule prefix:

- `0`: no selections are complete; the current slot is Overall Pick 1;
- `1`: Overall Pick 1 is complete; the current slot is Overall Pick 2;
- `schedule.length`: all scheduled selections are complete.

The valid range is the inclusive integer range `0..schedule.length`. Invalid counts are rejected. The current slot is `schedule[completedPickCount]`, so completion deliberately returns `null` rather than throwing or naming a misleading picker. This is scheduling state only and is not persisted in Phase 4.

## Draft position and manager pick numbers

Draft position is the manager's one-based place in the supplied first-round order. All overall picks for a manager are obtained by filtering the generated schedule. The implementation does not use a special formula for the first, last, or any other position.

## User turns

The engine groups adjacent schedule slots with the same manager ID. A middle-position manager usually receives single-pick turns. At a snake edge, a manager frequently selects at the end of one round and immediately again at the start of the next.

This matters to future Best Fit logic: at Picks 12 and 13, a future service may need to evaluate the best pair of available players together instead of independently recommending one player twice. Phase 4 exposes the schedule grouping only; it does not score players or pairs.

## Turn Horizon contract

Turn Horizon starts immediately after the completed prefix and returns:

| Field | Exact meaning |
| --- | --- |
| `nextUserPickNumber` | First scheduled user pick with array index greater than or equal to `completedPickCount`; `null` when none remains. |
| `picksBeforeNextUserPick` | Number of still-pending schedule slots strictly before that next user pick. |
| `opponentPicksBeforeNextUserPick` | Among those strictly preceding slots, how many belong to other managers. |
| `nextUserPickIsFollowedByConsecutiveUserPick` | Whether the schedule slot immediately after the next user pick also belongs to the user. |
| `upcomingUserTurnPickNumbers` | The next user pick and every immediately adjacent user pick after it. Completed picks are never returned. |
| `firstPickAfterUpcomingUserTurn` | First scheduled slot after that consecutive group, or `null` at the end of the schedule. |
| `opponentPicksBeforeFollowingUserTurn` | Other-manager slots after the upcoming turn and strictly before the next user turn; `null` when the user has no later turn. |

When no user pick remains, the next pick is `null`, both before-next counts are zero, the upcoming-turn array is empty, the consecutive flag is false, and the after/following fields are `null`.

The strict boundaries avoid off-by-one ambiguity. A completed pick is excluded. The next user pick itself is excluded from both before-next counts. Picks in the upcoming user turn are excluded from the between-turn count.

## Exact real six-manager example

First-round order:

```text
1 Vuk
2 Diego
3 Kristian
4 Miku
5 Tin
6 Deni
```

The first four rounds are:

```text
Round 1:  1 Vuk, 2 Diego, 3 Kristian, 4 Miku, 5 Tin, 6 Deni
Round 2:  7 Deni, 8 Tin, 9 Miku, 10 Kristian, 11 Diego, 12 Vuk
Round 3: 13 Vuk, 14 Diego, 15 Kristian, 16 Miku, 17 Tin, 18 Deni
Round 4: 19 Deni, 20 Tin, 21 Miku, 22 Kristian, 23 Diego, 24 Vuk
```

Vuk's exact picks are:

```text
1, 12, 13, 24, 25, 36, 37, 48, 49, 60, 61, 72, 73, 84, 85
```

Deni's exact picks are:

```text
6, 7, 18, 19, 30, 31, 42, 43, 54, 55, 66, 67, 78, 79, 90
```

Vuk's derived turns are `[1]`, then `[12, 13]`, `[24, 25]`, `[36, 37]`, `[48, 49]`, `[60, 61]`, `[72, 73]`, and `[84, 85]`.

After Pick 1 is complete, Vuk's next pick is 12. Pending Picks 2 through 11 are strictly before it and all belong to opponents, so `opponentPicksBeforeNextUserPick` is 10. The upcoming turn is `[12, 13]`; after it, Picks 14 through 23 contribute 10 opponent selections before Vuk's following turn `[24, 25]`. Immediately before Pick 12, at `completedPickCount = 11`, the same next pick and turn remain but the before-next opponent count is zero. After Pick 12, the next pick is 13 and the remaining upcoming turn is `[13]`.

## Explicit non-features

Phase 4 does not implement football player selections, drafted-player state, available-player removal, rosters, pick history, Best Fit, recommendation scores, pair scoring, projections, xG/xA/xGI, ICT, injury or health assessment, fixture analysis, FBref, scraping, trades, waivers, persistence, import/export, databases, authentication, the final Draft Room, or deployment.
