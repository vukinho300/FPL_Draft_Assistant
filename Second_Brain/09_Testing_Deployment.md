# Testing and Deployment

## Testing philosophy
Use the smallest meaningful test surface for each narrow Codex task.

During implementation:
- run the specific Vitest file(s) related to the changed domain/component;
- run `npm run typecheck` when TypeScript surfaces change;
- run focused manual/rendered verification only when UI behavior changed.

Do not automatically run the entire repository suite after every small change.

## PR/merge checkpoint
Before merge of a meaningful implementation PR, normally run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

Run `npm run verify:fpl-live` only when the live FPL boundary or current-player/ranking join is relevant.

Run Python/research tests only when `research/` or ranking-generation behavior changes.

## Regression priorities
Protect these invariants:
- immutable 90-pick official draft remains valid;
- current roster evolution never mutates the archived draft;
- unique player ownership;
- exact 2/5/5/3 squad composition after processed transactions;
- account authorization enforced server/database-side once auth exists;
- missing lineup never becomes fabricated historical data;
- admin point correction remains auditable;
- external schema failures fail clearly rather than silently guessing.

## Deployment target
Target: Vercel from the GitHub repository.

Current production-oriented boundary already exists:
```text
Browser -> GET /api/fpl -> project FPL handler -> public FPL Draft bootstrap
```

Local Vite mounts the same project-owned handler for development.

## Deployment sequence
F1 deployment should deploy the current `main` application before database/auth work.

Verify production views:
- League
- My Team
- Teams
- Matchday
- Players
- Transactions
- Draft Archive
- `/api/fpl`

Do not make Supabase a blocker for first deployment.

## Mobile sequence
After deployment, F2 is mobile responsiveness only.

Expected adaptations:
- desktop sidebar -> compact mobile navigation;
- multi-column grids -> responsive 2/1-column layouts;
- football pitch/player cards -> smaller responsive representation;
- wide tables -> safe horizontal scrolling/compact presentation.

Do not combine mobile work with auth/database changes.

## Environment variables
Keep deployment configuration outside source control.

When Supabase is introduced:
- public client configuration may use Vercel environment variables where appropriate;
- service-role/privileged secrets are server-only;
- never commit credentials.

## CI philosophy
CI is a merge confidence boundary, not a substitute for targeted local tests.

Avoid adding expensive broad workflows unless a concrete failure mode justifies them.

## Codex final report
For normal implementation tasks, request a compact report:
```text
Changed:
Tests:
Result:
Files:
SHA:
Known issue:
```

Large multi-section reports are reserved for architecture/research checkpoints.