# FPL Draft Assistant

**Phase 2 — Verified FPL Player Data Boundary**

FPL Draft Assistant is a personal web companion for an official Fantasy Premier League Draft. The long-term product will help organize manager order, available players, selections, and a user's squad while all official draft actions remain in the official FPL Draft service.

This repository now contains a tested server-side boundary that retrieves the current official FPL Draft bootstrap response and converts the fields the project understands into stable internal player models. It does not yet provide a working draft room.

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

Vite serves the frontend but does not execute the root Vercel Function at `/api/fpl`. Unit tests exercise the complete client and normalization path without Vercel. For optional end-to-end local function testing, use `vercel dev` from a separately installed Vercel CLI; the CLI is intentionally not a permanent project dependency.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

For an interactive test watcher, run `npm run test:watch`. To preview a production build locally, run `npm run preview` after building.

Run the optional live upstream verification separately:

```bash
npm run verify:fpl-live
```

This command requires network access and is intentionally excluded from the deterministic test and CI suites.

## Architecture overview

External FPL data passes through a dedicated server-side client, defensive validation, and normalization into project-owned domain models before reaching future business logic or React components:

```text
External FPL data -> adapter -> normalized models -> domain logic -> React UI
```

The Vercel Function at `GET /api/fpl` returns only the normalized project contract; it never proxies the full upstream response. See [docs/FPL_DATA_CONTRACT.md](docs/FPL_DATA_CONTRACT.md) for the verified mapping and its uncertainties.

Future draft persistence will follow a separate storage boundary backed by browser `localStorage`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for decisions and non-goals.

## Deployment target

Vercel is the intended deployment target, sourced from this GitHub repository. The serverless function source exists, but production deployment remains unconfigured in Phase 2.

## Current limitations

- No player ranking algorithm, projections, or recommendations
- No manager or snake-draft configuration
- No draft-room selection or history workflow
- No browser persistence or backup import/export
- No authentication, database, or official FPL actions
- No guarantee that the undocumented upstream endpoint or schema will remain stable

## Roadmap summary

The next technical phase should build deterministic, league-size-aware draft-board and ranking domain logic using only the normalized Player model. It must keep official Draft rank distinct from project calculations and avoid invented projections.
