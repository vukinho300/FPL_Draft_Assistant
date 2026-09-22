# Codex Session, Commit and Manual-Check Workflow

## Purpose
Keep Codex moving efficiently without repeatedly redoing environment setup, creating unnecessary commits/docs PRs, wasting model allowance, or treating every unavailable credential/manual check as a blocker.

## Core rule
Continue in the same Codex session while it remains useful and has the relevant repository/tool context. Do not restart setup, re-authenticate tools, or repeat environment commands when existing access still works.

## Task strategy before substantial work
Before a meaningful Codex task, ChatGPT/the orchestration layer should recommend:
- model + reasoning effort;
- Codex vs manual vs hybrid execution;
- any faster manual shortcut;
- whether a Second Brain update is expected or may be proposed.

Use `docs/workflow/AI_MODEL_POLICY.md` for the current mapping.

Model choice is advisory rather than a blocker: if the exact recommended model is unavailable, use the nearest suitable capability class and report the substitution.

Codex should report when discovered complexity materially justifies escalation, rather than silently spending a stronger model allowance by default.

## Prompting rule
ChatGPT defines the outcome, non-negotiable product/security/architecture constraints, scope, roadmap ordering and acceptance criteria. Codex owns implementation strategy after repository inspection.

## Minimum-sufficient context rule
For meaningful work:
1. inspect relevant repository state;
2. identify the smallest useful set of Second Brain notes;
3. read those notes first;
4. expand only when a conflict, gap or dependency requires it;
5. treat repository/code/database/deployed evidence as technical truth when documentation conflicts.

Do not blindly read the complete Second Brain for ordinary implementation work.

Prefer delta review when a previously audited state and a narrow known change set exist. Use a full audit only when correctness genuinely requires it.

## Second Brain approval gate
Second Brain changes are never automatic.

At a documentation checkpoint, Codex may propose a consolidated reconciliation. Before any edit to `Second_Brain/**`, show:
- file/folder;
- action;
- reason;
- concise proposed change;
- impact.

Then stop and wait for Vuk's explicit approval.

This rule applies to:
- end-of-roadmap-family reconciliation;
- milestone/status changes;
- decision-log additions;
- new files/folders;
- edits, moves, renames or deletions;
- material corrections that appear obvious.

After an approved change is applied, the final response must state exactly what changed, including additions/removals and the reason.

Individual implementation PRs normally leave `Second_Brain/**` unchanged unless the documentation change itself was explicitly approved as part of the task.

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

## Manual vs Codex vs hybrid
Before implementation, choose the lowest-total-effort reliable workflow.

Use Codex when repository edits, tests, multi-file inspection or automation are valuable.

Use manual work when Vuk can complete a step faster and more safely through a short UI/physical action.

Prefer hybrid work when Codex can implement/test the complex part and Vuk can perform a short real-device/dashboard/subjective verification.

When manual work is faster, provide:
- **Faster manually: Yes**
- the minimum steps;
- expected result;
- failure signal.

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
Codex performs technical checks it can perform reliably: repository inspection, tests, typecheck, lint, build, local integration, database/RLS/Storage checks, research quality gates, external read-contract verification where accessible, and deployment/configuration inspection where accessible.

Vuk performs checks that genuinely require his credentials, real phone/browser, unavailable authenticated external UI, or subjective visual/product judgment.

Never report an unperformed check as passed.

## Session continuity
Prefer continuing the existing Codex conversation through related work while it retains useful context.

Session continuity is separate from Git branching: each implementation step still uses the appropriate fresh short-lived task branch/PR.
