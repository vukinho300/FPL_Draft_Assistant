# FPL Draft Assistant

**Phase 4 — Manager Configuration, Snake Draft Engine, and Turn Horizon**

FPL Draft Assistant is a personal web companion for an official Fantasy Premier League Draft. The long-term product will help organize manager order, available players, selections, and a user's squad while all official draft actions remain in the official FPL Draft service.

This repository contains a tested player-data boundary, deterministic draft-board calculations, and a pure 15-round snake-schedule engine. It can model manager order, identify the user, locate the current picker from a completed-pick count, and describe the user's next-turn horizon. It does not yet select football players or provide persistent draft state.

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

External FPL data passes through a dedicated server-side client, defensive validation, and normalization into project-owned domain models before reaching business logic or React components:

```text
External FPL data -> adapter -> normalized models -> domain logic -> React UI
```

The Vercel Function at `GET /api/fpl` returns only the normalized project contract; it never proxies the full upstream response. See [docs/FPL_DATA_CONTRACT.md](docs/FPL_DATA_CONTRACT.md) for the verified mapping and its uncertainties.

The draft-board domain consumes only normalized `Player[]` and applies the official 2 GK / 5 DEF / 5 MID / 3 FWD roster contract. Candidate targets add a documented 35% project reserve separately to each position. Player ordering uses only normalized official Draft rank, with deterministic name and ID tie-breakers. See [docs/DRAFT_BOARD_LOGIC.md](docs/DRAFT_BOARD_LOGIC.md).

The schedule domain consumes a validated project-owned manager configuration. It reverses the supplied first-round order on alternate rounds, creates one-based immutable draft slots, derives manager pick numbers and consecutive turns, and calculates Turn Horizon from `completedPickCount`. See [docs/SNAKE_DRAFT_LOGIC.md](docs/SNAKE_DRAFT_LOGIC.md).

The current UI is a development demonstration. It defaults to the real project example Vuk, Diego, Kristian, Miku, Tin, and Deni; supports 2–16 managers, rename and move controls, a selectable user manager and completed-pick count; and previews the first four rounds. Those names are demo data, not domain assumptions. The UI does not load players or record selections, and refresh resets it.

Future draft persistence will follow a separate storage boundary backed by browser `localStorage`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for decisions and non-goals.

## Deployment target

Vercel is the intended deployment target, sourced from this GitHub repository. The serverless function source exists, but production deployment remains unconfigured in Phase 4.

## Current limitations

- No projections, VOR, AI recommendations, or hidden player-quality score
- No football player selections, available-player removal, roster, or pick history
- No Best Fit recommendations, pair scoring, or health/fixture analysis
- No browser persistence or backup import/export
- No authentication, database, or official FPL actions
- No FBref, scraping, or richer-metric integration
- No guarantee that the undocumented upstream endpoint or schema will remain stable

## Roadmap summary

The recommended next phase is verified FPL enrichment research and Best Fit model-design prerequisites. It should investigate evidence and contracts before selecting a scoring model. Player selection, persistence, and the final Draft Room remain later work.
