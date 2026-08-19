# Current Phase

## F0 — Second Brain Foundation
Status: IN REVIEW

## Goal
Create the concise Second Brain control manual from the existing repository and approved architecture **without changing application code**.

## Allowed changes
Only documentation under:
`Second_Brain/`

## Required notes
- `00_HOME.md`
- `01_Project_Purpose_Requirements.md`
- `03_Current_Architecture.md`
- `04_Data_Architecture_Sources.md`
- `05_Authentication_Security.md`
- `07_League_Rules_Product_Behavior.md`
- `09_Testing_Deployment.md`
- `11_Decision_Log.md`
- `12_Roadmap.md`
- `14_Project_Status.md`
- `15_Current_Phase.md`

## Acceptance criteria
- Existing repository/application code is unchanged.
- Second Brain reflects the merged Kile N Others dashboard baseline.
- It clearly separates implemented state from approved future architecture.
- Immutable draft-history rule is documented.
- Low-token Codex read map/workflow is documented.
- Vercel -> mobile -> Supabase dependency order is clear.
- Account/admin/RLS rules are clear.
- Missing-lineup and score-correction behavior is clear.
- Trading Block/trade-state behavior is clear.
- Data/photo acquisition is research-first and does not invent source contracts.

## Testing
No application test suite is required for documentation-only F0.

Verification is repository-level:
- compare branch against `main`;
- confirm every changed path is under `Second_Brain/`;
- inspect documentation for contradictions with current code/merged PR #7.

## Next phase after merge
### F1 — Vercel Deployment
Scope:
- deploy the exact current `main` application;
- preserve current code behavior;
- verify all dashboard views and `/api/fpl` in production;
- configure only deployment necessities;
- do not add Supabase/auth/mobile redesign in F1.

Codex should read only:
- `Second_Brain/00_HOME.md`
- `Second_Brain/09_Testing_Deployment.md`
- `Second_Brain/15_Current_Phase.md`

## Workflow reminder
After F0 is independently verified and merged, update this note manually to mark F0 COMPLETE and F1 CURRENT before sending the next Codex task.