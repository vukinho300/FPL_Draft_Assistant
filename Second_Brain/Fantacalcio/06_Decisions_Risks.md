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

### F-D011 — 2026/27 initial auction roster/economy contract
The first auction uses 8 managers, 500 credits each and a mandatory 25-player Classic roster of 3 POR / 8 DIF / 8 CEN / 6 ATT. Minimum purchase price is 1 credit. Maximum legal bid must preserve at least 1 credit for each mandatory slot still unfilled after the current purchase.

### F-D012 — Defense modifier uses base votes only
The goalkeeper is included in the defense modifier. For the goalkeeper and defenders, only the base vote contributes to the modifier; ordinary bonus/malus such as clean-sheet or penalty-save bonuses do not enter the modifier average.

Known commissioner bands begin:
- 6.00–6.24 → +1;
- 6.25–6.49 → +2;
- bands continue in 0.25 increments.

The full upper table/cap remains unconfirmed and must not be invented.

### F-D013 — Injury refund remains unresolved
Do not treat a season-ending injury as a guaranteed 100% refund until commissioner confirmation. Vuk believes that is likely, but the current auction/model contract must preserve this as uncertainty.

### F-D014 — Fantacalcio authorization authority
Fantacalcio access is an explicit, admin-managed capability bound to the verified Supabase Auth user ID.

Frontend product visibility may reflect that capability, but it is not the security boundary. Fantacalcio-protected database state must be enforced through RLS, and any private Fantacalcio API boundary must verify authenticated identity plus the current capability before returning protected data or performing protected actions.

Do not derive Fantacalcio authorization from:
- manager or team display name;
- Commissioner presentation;
- FPL `LEAGUE_OWNER` role;
- immutable FPL roster identity;
- client-side navigation state.

Missing capability means denied. This decision intentionally avoids turning the initial implementation into a broad generic RBAC system unless a future requirement justifies one.

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
- complex models outperforming only because of leakage or tuning bias;
- incorrectly treating modifier value as ordinary individual bonus points.

### Auction economics
- limited historical league-specific prices;
- early inflation estimates based on tiny samples;
- opponent behavior is not perfectly rational;
- incorrect squad constraints can invalidate max-bid logic;
- injury refund uncertainty changes downside protection.

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
