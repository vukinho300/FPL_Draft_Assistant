# Architecture

## Purpose

FPL Draft Assistant is a personal companion application for an official Fantasy Premier League Draft. It helps a user organize draft-night information without replacing or controlling the official service.

## Scope

The product scope is a draft-night companion: manager setup, a local draft board, available-player discovery, pick tracking, history, undo, and backup are planned. The current implementation establishes the player-data boundary but does not implement those draft-night features.

## Initial stack

The client uses React, Vite, and TypeScript. npm manages dependencies, Vitest runs unit tests, and Oxlint provides lightweight static analysis. Node.js 24 is the recorded development and CI runtime.

## Architecture

The intended dependency flow is:

```text
External FPL data
       ↓
FPL adapter
       ↓
Normalized internal models
       ↓
Domain logic
       ↓
React UI
```

External response structures stop at the adapter boundary. Components consume stable project-owned models, while important calculations remain pure and testable independently of React. `src/services/fpl` validates the small upstream surface it needs and maps it into the `src/domain` Player model.

Planned source areas are:

- `src/domain`: project-owned types and pure business rules.
- `src/services`: external-data interfaces and adapters.
- `src/storage`: browser persistence abstractions.
- `src/components`: reusable UI components.
- `src/features`: application-level feature areas.

Only a source area needed by the current phase should be created.

## Persistence decision

Future personal draft state will use browser-local persistence through a storage adapter backed by `localStorage`. State therefore will not automatically be shared between different browsers or devices. Export and import can later provide an explicit transfer mechanism.

## Deployment model

The planned delivery path is GitHub to Vercel. `api/fpl.ts` is a thin Vercel Function entry point, but deployment and credentials are intentionally not configured in this phase.

The production request flow is:

```text
Browser -> GET /api/fpl -> FPL client -> official FPL Draft endpoint
```

The Vite development server does not execute root Vercel Functions. Deterministic tests exercise the integration modules directly. Developers who need end-to-end local function execution may use a separately installed Vercel CLI and `vercel dev`; the CLI is not a project dependency.

## External FPL data

The integration currently retrieves `https://draft.premierleague.com/api/bootstrap-static` on the server. It was live-verified at `2026-08-17T11:32:17.936Z` with HTTP 200 and an `application/json` response containing 587 players, 20 teams, and four position definitions.

The endpoint is an undocumented or insufficiently documented implementation detail. Its availability and schema are not guaranteed. For that reason:

- the client checks HTTP status and content type before parsing;
- the normalizer treats input as `unknown` and validates only required fields;
- raw response shapes remain inside `src/services/fpl`;
- unknown club or position references and invalid player records fail the response rather than being silently guessed or skipped;
- `/api/fpl` returns only `retrievedAt`, `playerCount`, and normalized players;
- the response is marked `no-store` in this phase.

The Player model adopts the upstream numeric `id` as a project-owned string ID, `web_name` as the display label, the referenced team name and short name as a Club, the explicitly mapped position, and `draft_rank` as a nullable official ordinal. The upstream response does not formally define the semantics of `draft_rank`; it must not be described as projected points or a project recommendation.

The response also exposed `status` codes and numerous statistics, but their precise current semantics were not established by the response itself. They are intentionally omitted. Full field evidence and failure categories are documented in [FPL_DATA_CONTRACT.md](FPL_DATA_CONTRACT.md).

## Non-goals for v1

- FPL account authentication
- Automatically submitting official picks
- Modifying the official draft order
- Trades
- Waivers
- Season-long league management
- A remote database
- AI recommendations
- A fabricated projection model

## Verification philosophy

Important calculations must be deterministic and covered by focused unit tests. Tests should use the smallest fixtures that demonstrate behavior, keep external integration at explicit boundaries, and avoid large fabricated player datasets.
