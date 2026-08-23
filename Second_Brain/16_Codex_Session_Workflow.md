# Codex Session and Manual-Check Workflow

## Purpose
Keep Codex moving efficiently without repeatedly redoing environment setup or treating every unavailable credential/manual check as a blocker.

## Core rule
Continue in the same Codex session while it remains useful and has the relevant repository/tool context. Do not restart setup, re-authenticate tools, or repeat environment commands merely because a new prompt is sent when the existing session already has that access.

## Prompting rule
ChatGPT should define the outcome, non-negotiable product/security/architecture constraints, scope, and acceptance criteria. Codex owns the implementation strategy after inspecting the repository.

Prompts must respect the access already known to exist in the current Codex session. Do not assign Codex tasks that we already know require credentials, devices, or external access it does not have.

## When Codex reaches a boundary
A missing credential, unavailable browser/device, or manual-only check is not automatically a blocker for the whole task.

Codex should:
1. continue all work that is still possible with its current access;
2. verify everything it can verify itself;
3. isolate only the inaccessible step;
4. give Vuk a concise **Manual verification for Vuk** section with the exact action/test, expected result, and failure signal;
5. continue the same task after Vuk reports the manual result when further work remains.

Codex should not stop early merely because one end-to-end check cannot be automated.

## Credentials
Production user passwords and other personal login credentials remain with Vuk by default. Codex should not require them merely to implement or verify surrounding infrastructure. If a user-level login test requires a real password, Vuk performs that manual test unless there is an explicit reason to provide the credential through a secure mechanism.

Infrastructure authentication already established in the current terminal/session should be reused. Do not ask Vuk to repeat login/link commands unless Codex actually detects that the existing access is missing, expired, or invalid.

## Verification ownership
Codex performs technical checks it can perform reliably: repository inspection, tests, typecheck, lint, build, local integration, database/RLS checks, deployment/configuration checks, and other available automated verification.

Vuk performs checks that genuinely require his credentials, real phone/browser, or subjective visual/product judgment.

Never report an unperformed check as passed.

## Session continuity
Prefer continuing the existing Codex conversation for follow-up work on the same phase so it retains repository and execution context. A new Codex session is appropriate only when the current one is no longer useful, context has become misleading, or a clean restart is genuinely beneficial.

This session-continuity rule is separate from Git branching: implementation work should still use the appropriate short-lived Git branch/PR workflow when repository changes require it.