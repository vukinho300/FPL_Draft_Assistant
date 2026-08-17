# Architecture

## Purpose

FPL Draft Assistant is a personal companion application for an official Fantasy Premier League Draft. It helps a user organize draft-night information without replacing or controlling the official service.

## Scope

The product scope is a draft-night companion: manager setup, a local draft board, available-player discovery, pick tracking, history, undo, and backup are planned. This foundation does not implement those features.

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

External response structures must stop at the adapter boundary. Components consume stable project-owned models, while important calculations remain pure and testable independently of React. The initial `src/domain` player model establishes that boundary without guessing an upstream API schema.

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

The planned delivery path is GitHub to Vercel. Vercel deployment and credentials are intentionally not configured in this phase.

## External FPL data

External FPL integration has **not** been implemented. A future phase should introduce an adapter that maps verified upstream data into internal models before the UI or domain logic consumes it.

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
