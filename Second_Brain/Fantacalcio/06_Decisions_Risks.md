# Fantacalcio — Decisions and Risks

## Approved decisions

### F-D001 — Same repository/platform, separate Fantacalcio domain
Share auth/Supabase/Vercel/testing infrastructure where useful. Do not merge Fantacalcio football identities, scoring, projections or auction economics into FPL-specific domain models.

### F-D002 — Vuk-only initial access
Fantacalcio is private to Vuk's authenticated account/capability. Frontend hiding alone is insufficient; privileged data/actions require backend/RLS/API authorization where applicable.

### F-D003 — Laptop-first
The first Fantacalcio implementation targets the laptop/desktop auction workflow. Mobile UI is deferred without intentionally blocking future support.

### F-D004 — Baseline-first modelling
No model family is preselected. Simple leakage-safe baselines are mandatory. Complex models enter production only if chronological evidence justifies them.

### F-D005 — Production and availability are distinct
Evaluate production when available, playing time and availability/injury risk separately before combining them into remaining-season value.

### F-D006 — Exact current league rules control valuation
Do not optimize against generic Fantacalcio scoring when the real league differs.

### F-D007 — One clean release for the first official asta
For the initial auction cycle, prioritize one clean validated data/model evaluation release rather than a large continuously refreshing DB/model subsystem. The current international-break context makes recurring refresh infrastructure low priority.

A deliberate rebuild is still allowed if a material event occurs before the auction.

### F-D008 — FD1 is a dedicated Serie A/Fantacalcio source-research phase
Do not reuse Premier League/FPL source assumptions. Research providers deeply, including advanced stats where they materially improve evaluation and pass quality/licensing/timestamp gates.

### F-D009 — Auction runs against a frozen release
The live auction should use a known projection release ID. External data/model changes must not silently alter recommendations mid-asta.

### F-D010 — Second Brain edits are approval-gated
Codex may propose changes, but no `Second_Brain/**` edit occurs without Vuk's explicit approval. Approved changes must be reported exactly afterward.

## Key risks

### Data/source
- terms/licensing;
- historical coverage gaps;
- unstable/no player IDs;
- bad as-of/timestamp semantics;
- mismatched role/scoring providers;
- injuries/probable lineups that are incomplete or speculative.

### Identity
- duplicate names;
- transfers;
- inconsistent club spelling;
- player ID changes across providers;
- one-to-many join explosions.

### Modelling
- temporal leakage;
- small current-season sample;
- overfitting new signings;
- injury-risk overconfidence;
- cross-league translation without validation;
- complex models outperforming only because of leakage or tuning bias.

### Auction economics
- limited historical league-specific prices;
- early inflation estimates based on tiny samples;
- opponent behavior is not perfectly rational;
- incorrect squad constraints can invalidate max-bid logic.

### Operational
- data loss during auction;
- duplicate sales;
- budget inconsistency;
- slow data entry;
- model/source failure too close to auction;
- silent release changes.

## Research posture

Verify before assuming.

Important facts should have source/provenance. Uncertainty and missingness are explicit states, not values to clean around silently.

Advanced statistics are candidate evidence, not automatically useful features.
