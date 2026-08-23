# FPL Draft Assistant contributor instructions

GitHub repository `andrijasevicvuk-alt/FPL_Draft_Assistant` is the technical source of truth.

## Purpose and product constraints

FPL Draft Assistant is a private six-team season-long FPL Draft companion for Kile N Others. It preserves immutable draft history while adding persistent league accounts, shared season state, Gameweek features, transactions, and other approved roadmap work.

- Never modify an official FPL Draft league automatically, bypass authentication/security, or alter official server-side state unless an explicitly approved future task proves and authorizes that write path.
- Never invent player data, projections, statistics, IDs, image mappings, league data, or external API contracts. Distinguish official data, project-derived data, and unavailable data.
- Supabase Auth/Postgres/RLS/Storage are the approved persistent backend. Persistent mutable league state must not use device-local storage as authoritative truth.
- Vercel is the deployment target, with this GitHub repository as source control.
- The immutable official 2026/27 draft must never be rewritten to reflect later league activity.

## Architecture

Maintain this dependency direction where applicable:

```text
External FPL data -> project adapter -> normalized internal models -> domain logic -> React UI
Authenticated browser -> Supabase Auth/RLS -> project-owned persistent league state
Immutable official draft + processed transactions -> current rosters
```

- Keep upstream response structures inside external-data adapters; do not leak them through React components.
- Keep important domain logic pure and independently testable outside React where practical.
- Prefer simple, readable TypeScript and minimal dependencies over premature abstraction.
- Preserve working architecture unless there is a concrete reason to change it.
- Do not silently invent missing requirements; report assumptions and uncertainty.

## Codex execution autonomy

Codex owns implementation strategy for repository work.

For each task, first inspect the relevant repository state, tests, contracts, and Second Brain notes, then choose the implementation approach that best satisfies the requested outcome.

Prompts from ChatGPT should normally define:
- the user/product goal;
- non-negotiable product, data, security, and architecture constraints;
- scope boundaries and what is intentionally out of scope;
- acceptance criteria and required evidence of correctness.

Prompts should NOT normally prescribe exact files, component structures, selectors, CSS techniques, SQL helper shapes, command sequences, or step-by-step implementation details when Codex can determine those more reliably from the repository.

Codex may deviate from a suggested implementation approach when repository evidence shows a safer, simpler, faster, or more maintainable solution, provided the product/security constraints and acceptance criteria are preserved. When it does, explain the reasoning in the final report.

Use prescriptive implementation instructions only when they protect a true invariant, such as security boundaries, immutable data, migration safety, source-of-truth rules, or a previously approved architecture decision.

## Verification ownership

Codex should perform every verification it can perform reliably itself, including relevant automated tests, type checking, linting, builds, local integration tests, database/RLS checks, and repository inspection.

Do not leave a check to Vuk merely because it is inconvenient if Codex can perform it accurately.

For checks that genuinely require Vuk, a real device, an authenticated external UI, unavailable credentials, or subjective visual/product judgment, the final report must include a concise **Manual verification for Vuk** section with:
- exactly what to test;
- exact expected result;
- what failure would look like;
- only the minimum steps needed.

If no manual verification is needed, say so explicitly.

Never claim a test, browser check, deployment check, or integration check passed unless it was actually performed.

## Working practices

- Inspect the existing implementation before changing it.
- Read only the relevant Second Brain notes and repository areas needed for the task; expand scope only when evidence requires it.
- Add deterministic tests for important new behavior and run the relevant verification before committing.
- Run type checking, tests, build, lint, database/RLS checks, or other verification when affected by a change.
- Codex should not edit `Second_Brain/**` during normal implementation tasks unless explicitly assigned a documentation task.
- Do not commit credentials, API tokens, secrets, generated dependency folders, or local environment files.
- Stage explicit paths rather than broad `git add .` / `git add -A` during project tasks.
- Use short-lived task branches from current `main`.
- Open a Draft PR and do not merge it; Vuk alone merges implementation and documentation PRs.
- Never claim a GitHub push succeeded without verifying the remote ref.

## Final report expectations

Keep the report concise but sufficient for review. Include:
- what changed and why;
- important implementation decisions Codex made;
- verification actually performed and results;
- anything not verified and why;
- **Manual verification for Vuk** when needed;
- branch / commit / Draft PR information when repository changes were made;
- known limitations or follow-up work.
