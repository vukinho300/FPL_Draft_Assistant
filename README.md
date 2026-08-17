# FPL Draft Assistant

**Status: Phase 1 — Project Foundation**

FPL Draft Assistant is a personal web companion for an official Fantasy Premier League Draft. The long-term product will help organize manager order, available players, selections, and a user's squad while all official draft actions remain in the official FPL Draft service.

This repository currently contains the tested application foundation only. It does not yet load FPL players or provide a working draft room.

## Prerequisites

- Node.js 24 (recorded in `.nvmrc`)
- npm 11 or a compatible npm version

## Install

Install exactly the dependencies in the lockfile:

```bash
npm ci
```

## Development

Start the local Vite development server:

```bash
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

For an interactive test watcher, run `npm run test:watch`. To preview a production build locally, run `npm run preview` after building.

## Architecture overview

External FPL data will pass through a dedicated adapter and be normalized into project-owned domain models before reaching business logic or React components:

```text
External FPL data -> adapter -> normalized models -> domain logic -> React UI
```

Future draft persistence will follow a separate storage boundary backed by browser `localStorage`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for decisions and non-goals.

## Deployment target

Vercel is the intended deployment target, sourced from this GitHub repository. Deployment is not configured in Phase 1.

## Current limitations

- No external FPL data integration
- No player rankings, projections, or recommendations
- No manager or snake-draft configuration
- No draft-room selection or history workflow
- No browser persistence or backup import/export
- No authentication, database, or official FPL actions

## Roadmap summary

The next technical phase should establish and test the external FPL player-data boundary: a service interface, verified upstream adapter, and mapping into normalized internal player models. Later phases can build deterministic draft logic, the UI workflow, and browser-local persistence on those boundaries.
