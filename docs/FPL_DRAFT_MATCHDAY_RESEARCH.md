# FPL Draft Matchday API Research

Research timestamp: 2026-08-18 (Europe/Zagreb). This is endpoint discovery and safe public-GET probing only. The FPL Draft API remains undocumented or insufficiently documented; discovered routes are not a stability guarantee.

## Method

- Inspected the public application at `https://draft.premierleague.com/`.
- Inspected public bundle `/assets/index-X8CC7kJT.js` (SHA-256 `74c430221b7f354adb8d48e3f99039d23d3e8b7b9fceb08a1775475e5554b341`).
- Sent GET requests only. Placeholder ID `0` was used for identifier-dependent endpoints; no private league or entry was accessed.
- Did not sign in, send mutations, scrape authenticated pages, or attempt to bypass security.

## Capability matrix

| Capability | Status | Evidence and constraint |
|---|---|---|
| Current player pool and official Draft ranks | **AVAILABLE** | Public `GET /api/bootstrap-static` returned JSON with 590 players. This is the existing normalized adapter boundary. |
| Global game status | **AVAILABLE** | Public `GET /api/game` returned `current_event`, `next_event`, processing, trade-approval, and waiver-processing fields. A production contract is not implemented yet. |
| Event fixtures | **AVAILABLE** | Public `GET /api/event/{event}/fixtures` returned fixture JSON for Event 1. Response schema still requires a project adapter. |
| Global event live player data | **AVAILABLE** | Public `GET /api/event/{event}/live` returned element and fixture containers. It is global event data, not a manager total by itself. |
| League standings/details | **UNVERIFIED** | The bundle calls `GET /api/league/{league}/details`; placeholder ID returned 404 rather than an auth error. The project does not possess or validate the real league ID or response. |
| Manager Gameweek picks/subs | **UNVERIFIED** | The bundle calls `GET /api/entry/{entry}/event/{event}`; placeholder entry returned 404 rather than an auth error. Real entry IDs and schema are not verified. |
| Own editable Gameweek team | **REQUIRES AUTH** | `GET /api/entry/{entry}/my-team` returned 403 “Authentication credentials were not provided.” The project will not use this endpoint without a future authorized design. |
| League transaction history | **UNVERIFIED** | The bundle calls `GET /api/draft/league/{league}/transactions`; placeholder league returned 404. Real league response is not verified. |
| Entry transaction history | **REQUIRES AUTH** | `GET /api/draft/entry/{entry}/transactions` returned 403 without credentials. |
| League trades | **UNVERIFIED** | The bundle calls `GET /api/draft/league/{league}/trades`; placeholder league returned 404. |
| Current/approval trade views | **REQUIRES AUTH** | Entry-level current and approval routes returned 403 without credentials. |
| League player ownership/free-agent status | **UNVERIFIED** | The bundle references `GET /api/league/{league}/element-status`; placeholder league returned 404. The dashboard currently derives ownership from the frozen draft plus processed project transactions. |
| Waiver status and submission | **REQUIRES AUTH / MUTATION** | The bundle uses entry-scoped waiver routes and POST requests. No call was attempted. |
| Free-agent submission | **REQUIRES AUTH / MUTATION** | The bundle uses `POST /api/draft/entry/{entry}/free-agency`. No call was attempted. |
| Player injury/availability semantics | **UNVERIFIED** | Bootstrap exposes status-related fields, but the existing normalized contract deliberately omits them because semantics have not been verified. |

## Safe implementation boundary

The current Matchday page remains a shell. The next adapter may safely begin with public game status, fixtures, and global event-live data. League standings, manager totals, lineups, ownership, and history require the real league/entry identifiers plus captured response fixtures and validation tests. Authentication-only or mutation routes remain out of scope.

No regular FPL endpoint is assumed to have identical meaning in FPL Draft. No endpoint shape is allowed to leak directly into React.
