# Agent Access Boundaries

## Purpose
This note defines which project surfaces Codex, ChatGPT, and Vuk can access and how work should continue when one of those actors reaches an access boundary. The goal is to prevent tasks from being abandoned merely because one verification or credential-dependent step cannot be performed by the current actor.

## Core rule
A missing capability is a boundary, not automatically a blocker.

Codex and ChatGPT should complete every part of a task that is possible with their actual access. If a remaining step genuinely requires Vuk, the task report must isolate that step under **Manual verification for Vuk** instead of treating the whole task as failed or blocked.

## Codex access
Codex runs locally in the repository through the user's PowerShell environment.

Codex normally has access to:
- the local Git repository and working tree;
- repository code, tests, migrations, scripts, AGENTS.md, and relevant Second Brain notes;
- local Node/npm tooling and project scripts;
- local Supabase CLI and local Supabase when installed/configured;
- hosted Supabase through the Supabase CLI once Vuk has authenticated the CLI and linked the repository to the intended project;
- Vercel CLI/project access when authenticated in the local environment;
- Git/GitHub CLI access available in the local environment;
- automated tests, typecheck, build, lint, database/RLS checks, migration inspection, and other reproducible technical verification available from that environment.

Codex should own implementation strategy after inspecting the repository. It should not wait for ChatGPT to prescribe exact files, command order, SQL helper shapes, component structure, or test seams unless a project invariant requires it.

## Codex does not automatically have
Codex should assume it does NOT have the following unless Vuk has explicitly configured them in the local environment:
- production account passwords;
- browser-saved sessions from Vuk's personal browser;
- credentials typed only into ChatGPT;
- ChatGPT plugin connections;
- arbitrary external-service access that has not been authenticated locally;
- subjective visual approval from Vuk.

Production account passwords should normally stay with Vuk. Codex does not need them merely to inspect or manage Supabase schema, migrations, RLS, or project configuration.

## ChatGPT access
ChatGPT can inspect and review the GitHub repository through its connected GitHub tools and can independently verify Codex's claimed repository changes.

When connected, ChatGPT may also have direct plugin access to external services such as hosted Supabase. This access is separate from Codex's local CLI access and is useful for independent verification or service-side administration.

ChatGPT should not assume Codex inherits ChatGPT plugin connections.

ChatGPT's normal role is to:
- translate Vuk's product intent into a clear outcome, constraints, scope, and acceptance criteria;
- preserve approved architecture, data, and security rules;
- let Codex decide implementation details;
- independently inspect PRs, code, CI, and connected-service state;
- return PASS/FIX/FAIL before Vuk merges.

## Vuk-only responsibilities
Vuk remains responsible for actions that are inherently personal, credential-sensitive, or subjective, including when applicable:
- entering or choosing production user passwords;
- one-time interactive login/authorization when a CLI or external service requires it;
- final phone/device checks when no reliable browser automation exists;
- subjective visual/product approval;
- merging PRs.

These responsibilities should be minimized. Codex should not hand routine technical verification back to Vuk if it can perform it reliably itself.

## Boundary handling rule
When Codex reaches an unavailable capability:
1. Continue with every independent part of the task that remains possible.
2. Do not label the whole task blocked unless the missing capability truly prevents all meaningful progress.
3. Explain exactly what could not be performed and why.
4. Provide the minimum manual action Vuk must take.
5. State what result Vuk should expect and what failure would mean.
6. Resume or complete all other verification Codex can perform.

## Manual verification for Vuk
Use this section only when needed.

Each item should include:
- **Action:** the exact minimal step Vuk must perform;
- **Expected result:** what success looks like;
- **Failure signal:** what result indicates a real problem;
- **Why manual:** the access/capability Codex does not have.

Do not include checks here that Codex could have performed itself.

## Hosted Supabase boundary
For hosted Supabase work:
- Codex should use its locally authenticated Supabase CLI when available.
- Vuk may authenticate the CLI once and link the repository to the intended hosted project; after that Codex should use that access for future Supabase tasks.
- ChatGPT may independently inspect the same hosted project through the connected Supabase plugin.
- Codex does not need production league-user passwords for schema, migrations, RLS, remote database inspection, or project configuration.
- If production Auth-user creation or login testing requires user passwords and Vuk wants to keep them private, Codex should finish all non-password work first and leave only those credential-dependent checks to Vuk.

Current hosted project for Kile N Others:
- Supabase project name: `KNO`
- project ref: `asrrkwyqerfkynhjypov`
- region: `eu-central-1`

## Hosted Vercel boundary
For Vercel work:
- Codex should use authenticated Vercel CLI access when present.
- It may inspect project/deployment/environment configuration and perform safe deployment work within the task scope.
- Browser-safe Supabase configuration may be placed in Vite/Vercel environment variables.
- Secret/service-role Supabase credentials must never be exposed to browser/VITE variables.

## Reporting rule
Codex final reports should clearly separate:
- work completed;
- verification completed by Codex;
- external-service state actually verified;
- unresolved limitations;
- **Manual verification for Vuk**, only when genuinely necessary.

Never claim an unperformed check passed.