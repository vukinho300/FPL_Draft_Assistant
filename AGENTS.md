# FPL Draft Assistant repository contributor instructions

GitHub repository `andrijasevicvuk-alt/FPL_Draft_Assistant` is the technical source of truth.

## Purpose and product constraints

The repository contains:
- the private six-team season-long FPL Draft companion for Kile N Others; and
- a private Fantacalcio Auction Assistant side project for Vuk, developed as a separate product/domain inside the same application and platform.

The FPL product preserves immutable draft history while adding persistent league accounts, shared season state, Gameweek features, transactions, and other approved roadmap work.

- Never modify an official FPL Draft league automatically, bypass authentication/security, or alter official server-side state unless an explicitly approved future task proves and authorizes that write path.
- Never invent player data, projections, statistics, IDs, image mappings, league data, Fantacalcio data, or external API contracts. Distinguish source facts, project-derived data, and unavailable/unverified data.
- Supabase Auth/Postgres/RLS/Storage are the approved persistent backend for project-created product state unless an approved task establishes a separate research-local store for analytical data.
- Vercel is the deployment target, with this GitHub repository as source control.
- The immutable official 2026/27 FPL custom draft must never be rewritten to reflect later league activity.
- Keep Fantacalcio football data, scoring, projections, auction economics, and player identities separate from FPL-specific domain models even when platform infrastructure is shared.

## Architecture

Maintain this dependency direction where applicable:

```text
External source -> project adapter -> normalized internal models -> domain logic -> React UI
Authenticated browser -> Supabase Auth/RLS -> project-owned persistent state
Research raw snapshots -> validated canonical data -> leakage-safe features -> versioned model outputs
```

- Keep upstream response structures inside external-data adapters; do not leak them through React components.
- Keep important domain logic pure and independently testable outside React where practical.
- Prefer simple, readable TypeScript/Python and minimal dependencies over premature abstraction.
- Preserve working architecture unless there is a concrete reason to change it.
- Do not silently invent missing requirements; report assumptions and uncertainty.

## Codex execution autonomy

Codex owns implementation strategy for repository work.

For each substantial task:
1. inspect the relevant repository state, tests and contracts;
2. identify the minimum sufficient Second Brain context;
3. read only those relevant notes first and expand only when evidence requires it;
4. treat repository/code/database/deployed evidence as technical truth when documentation conflicts.

Fantacalcio tasks should normally start from `Second_Brain/Fantacalcio/00_HOME.md` and then retrieve only the task-relevant Fantacalcio notes.

Prompts from ChatGPT should normally define:
- the user/product goal;
- non-negotiable product, data, security, and architecture constraints;
- scope boundaries and what is intentionally out of scope;
- acceptance criteria and required evidence of correctness.

Prompts should NOT normally prescribe exact files, component structures, selectors, CSS techniques, SQL helper shapes, command sequences, or step-by-step implementation details when Codex can determine those more reliably from the repository.

Codex may deviate from a suggested implementation approach when repository evidence shows a safer, simpler, faster, or more maintainable solution, provided the product/security constraints and acceptance criteria are preserved. When it does, explain the reasoning in the final report.

Use prescriptive implementation instructions only when they protect a true invariant, such as security boundaries, immutable data, migration safety, source-of-truth rules, leakage prevention, or a previously approved architecture decision.

## Task strategy and model efficiency

For substantial tasks, use `docs/workflow/AI_MODEL_POLICY.md` as the current model/effort mapping.

- Choose the cheapest capability class likely to complete the task correctly; correctness and safety take priority over usage savings.
- Treat model choice and reasoning effort as separate decisions.
- Escalate only when complexity, uncertainty, failed attempts, security/data risk, or cross-system reasoning justifies it.
- Consider whether Codex, a manual action by Vuk, or a hybrid workflow minimizes total effort while preserving reliability.
- When manual work is faster or genuinely necessary, give Vuk exact minimal steps, expected result and failure signal.
- Prefer delta review over full-project re-audit when a previously audited state and a narrow set of changes are known.
- If the exact recommended model is unavailable, use the nearest capability class and report the substitution rather than blocking ordinary work.

## Second Brain governance

The Second Brain is durable project context, not unquestioned technical truth.

**Never modify `Second_Brain/**` without Vuk's explicit approval of the proposed change.**

Codex may propose a Second Brain change at any time, but before editing it must show:
- file/folder;
- action (create/edit/move/rename/delete);
- reason;
- concise proposed content/change;
- impact.

Then stop and wait for Vuk's explicit approval.

This applies even to obvious milestone/status updates and end-of-roadmap-family reconciliation.

After an approved Second Brain modification, report exactly what changed, including additions, removals and the reason. Avoid unnecessary documentation churn or duplicated knowledge.

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
- Run type checking, tests, build, lint, database/RLS checks, research quality gates, or other verification when affected by a change.
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
- known limitations or follow-up work;
- whether a Second Brain update is recommended, without applying it unless already approved.
