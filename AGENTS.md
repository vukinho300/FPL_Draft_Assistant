# FPL Draft Assistant contributor instructions

GitHub repository `andrijasevicvuk-alt/FPL_Draft_Assistant` is the technical source of truth.

## Purpose and product constraints

FPL Draft Assistant is a personal draft-night companion for the official Fantasy Premier League Draft service. It is a draft board, not a replacement for that service.

- Never modify an official FPL Draft league, automatically submit official picks, bypass authentication or security, or attempt to alter the official server-side draft order.
- Never invent player data, projections, or statistics. Never label internally invented values as official FPL data.
- Do not add Supabase, Firebase, PostgreSQL, another remote database, user accounts, or authentication for v1.
- Personal draft state will use browser `localStorage`; keep persistence behind a storage abstraction.
- Vercel is the deployment target, with this GitHub repository as source control.

## Architecture

Maintain this dependency direction:

```text
External FPL data -> FPL adapter -> normalized internal models -> domain logic -> React UI
Draft state -> storage adapter -> localStorage
```

- Keep upstream response structures inside external-data adapters; do not leak them through React components.
- Keep important domain logic pure and independently testable outside React where practical.
- Prefer simple, readable TypeScript and minimal dependencies over premature abstraction.
- Preserve the working architecture unless there is a concrete, documented reason to change it.
- Do not silently invent missing requirements; report assumptions and uncertainty.

## Working practices

- Inspect the existing implementation before changing it.
- Add deterministic unit tests for important calculations and run all relevant tests before committing.
- Run type checking, tests, build, and lint when affected by a change.
- Update documentation whenever architecture or developer workflows change.
- Do not commit credentials, API tokens, secrets, generated dependency folders, or local environment files.
- Never claim a GitHub push succeeded without verifying the remote ref.
