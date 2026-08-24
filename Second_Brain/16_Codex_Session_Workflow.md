# Codex Session, Commit and Manual-Check Workflow

## Purpose
Keep Codex moving efficiently without repeatedly redoing environment setup, creating unnecessary commits/docs PRs, or treating every unavailable credential/manual check as a blocker.

## Core rule
Continue in the same Codex session while it remains useful and has the relevant repository/tool context. Do not restart setup, re-authenticate tools, or repeat environment commands when existing access still works.

## Prompting rule
ChatGPT defines the outcome, non-negotiable product/security/architecture constraints, scope, roadmap ordering and acceptance criteria. Codex owns implementation strategy after repository inspection.

## Roadmap-family documentation cadence
Second Brain reconciliation happens at the **end of a roadmap letter family**, not after every numbered implementation step.

Examples:
- A1 / A1.5 / A2 / A3 -> one consolidated end-of-A reconciliation.
- G1 / G2 / G3 / G4 / G5 / G5A / G6 -> one consolidated end-of-G reconciliation after the approved G work is complete.

Individual implementation PRs normally leave `Second_Brain/**` unchanged.

An earlier Second Brain correction is allowed only when the documentation becomes materially false, unsafe, or likely to cause the next implementation task to violate the approved dependency order.

## Git / commit rule
Keep implementation tasks narrow, but keep commit history compact.

For a normal roadmap step:
- use one fresh short-lived branch;
- prefer one coherent implementation commit;
- avoid checkpoint/progress commits that add no review value;
- use additional commits only when they materially help debugging, review or follow-up fixes;
- open one Draft PR;
- never merge from Codex/ChatGPT;
- Vuk alone merges and may squash merge when appropriate.

Fewer commits must not be achieved by collapsing multiple roadmap steps into one oversized implementation task.

## When Codex reaches a boundary
A missing credential, unavailable browser/device, or manual-only check is not automatically a blocker for the whole task.

Codex should:
1. continue all work still possible with current access;
2. verify everything it can itself;
3. isolate only the inaccessible step;
4. give Vuk a concise **Manual verification for Vuk** section with exact action, expected result, and failure signal;
5. continue after Vuk reports the result when further work remains.

## Credentials
Production passwords and personal login credentials remain with Vuk by default. Codex should not require them merely to implement or verify surrounding infrastructure.

Infrastructure authentication already established in the current session should be reused. Do not ask Vuk to repeat login/link commands unless Codex actually detects missing, expired or invalid access.

## Verification ownership
Codex performs technical checks it can perform reliably: repository inspection, tests, typecheck, lint, build, local integration, database/RLS/Storage checks, external read-contract verification where accessible, and deployment/configuration inspection where accessible.

Vuk performs checks that genuinely require his credentials, real phone/browser, unavailable authenticated external UI, or subjective visual/product judgment.

Never report an unperformed check as passed.

## Session continuity
Prefer continuing the existing Codex conversation through related work in the same roadmap family while it retains useful context.

Session continuity is separate from Git branching: each implementation step still uses the appropriate fresh short-lived task branch/PR.
