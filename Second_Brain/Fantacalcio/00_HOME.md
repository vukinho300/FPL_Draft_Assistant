# Fantacalcio Auction Assistant — Home

## Purpose

Build a private, laptop-first Fantacalcio auction decision-support system for Vuk inside the existing application/repository.

The long-term objective is to combine:

**reliable Serie A/Fantacalcio data + remaining-season player projections + uncertainty + auction economics + opponent budgets + positional scarcity + dynamic maximum bids + very fast auction recording.**

The first usable product must remain simpler: a reliable auction ledger and desktop assistant must not be blocked on completion of the most sophisticated ML research.

## Source of truth

Repository code, migrations, tests, model artifacts, source manifests and verified runtime state are technical truth.

This Fantacalcio Second Brain records approved product/domain decisions and roadmap context. It does not override contradicting repository evidence.

## Product boundary

Fantacalcio is a sibling product mode inside the same repository/application.

Share where useful:
- authentication/session infrastructure;
- Supabase/Vercel platform;
- testing and provenance patterns;
- research-safety methodology;
- reusable UI primitives where appropriate.

Keep separate:
- Fantacalcio player identities and positions;
- Serie A/Fantacalcio source adapters;
- scoring rules;
- projections;
- injury/role models;
- auction state and economics;
- price recommendations.

Do not force Fantacalcio into FPL-specific player/ranking/league types.

## Access and platform scope

- Initial Fantacalcio access is Vuk-only.
- Authorization must be enforced server/database-side where data/actions require it, not only by hiding navigation.
- Initial UX is laptop/desktop-first.
- Mobile architecture should remain possible later, but mobile optimization is intentionally deferred.

## Confirmed 2026/27 league baseline

- season: **2026/27**;
- auction: before **10 October 2026**, expected to be imminent; exact date remains to be set;
- game mode: **Classic roles** with a head-to-head league competition;
- managers: **Achi, Massi, Peps, Vuk, Dan, Paolo, Gian/Edu, Francesco**;
- budget: **500 credits each**;
- squad: **25 players = 3 POR, 8 DIF, 8 CEN, 6 ATT**;
- player pool/roles: Fantacalcio Classic listone at auction time unless a commissioner override is explicitly confirmed;
- captain: off;
- defense modifier: on;
- initial minimum purchase price: **1 credit**;
- one repair auction is planned after the winter transfer market closes in 2027;
- trades are allowed after the initial auction.

The architecture should still support 10 managers without redesign.

## Initial data-cycle decision

For the upcoming official asta, do **not** build an elaborate always-refreshing database/model system as an early priority.

The current plan is one clean, validated evaluation/release from the best data available close enough to the auction to be useful. The current international-break context reduces the expected value of continuous refresh infrastructure.

If a material real-world change occurs before the auction (major injury, transfer/status correction, etc.), refresh/rebuild may still be triggered deliberately. Staleness/provenance must remain visible, but automated continuous refresh is not a milestone requirement for this first auction cycle.

## Retrieval map

- Product/league rules: `01_Product_Rules.md`
- Architecture and data: `02_Architecture_Data.md`
- Modelling and leakage: `03_Modeling_Leakage.md`
- Auction economics and desktop UI: `04_Auction_Economics_UI.md`
- Roadmap/current status: `05_Roadmap_Status.md`
- Durable decisions and risks: `06_Decisions_Risks.md`
- **Current official-auction delivery override:** `07_Auction_Sprint.md`

## Current phase

**FA0–FA3-S: COMPLETE.**

Production/repository state now includes:
- Vuk-only Fantacalcio authorization;
- persistent append-only auction ledger;
- 8 managers, 500 credits and 3/8/8/6 roster constraints;
- deterministic max-legal-bid enforcement;
- duplicate-sale protection and auditable undo;
- laptop recorder with manual fallback entry, manager board, history and JSON backup/export.

**FD1-S source research: COMPLETE.**

**Current delivery mode: 5-hour official-auction sprint.**

The product core exists. The critical path is now **data integrity first**:

`FD2-QA → MODEL_READY gate → FM-S → FE-S → app integration/rehearsal`.

No statistical model may be trusted or integrated until the canonical research release passes the mandatory data-integrity gate defined in `03_Modeling_Leakage.md` and `07_Auction_Sprint.md`.

Current sprint task: **FD2-QA — canonical data release + integrity audit**.

Remaining rule uncertainty is intentionally narrow:
- season-ending injury refund is **not confirmed**;
- the defense-modifier upper bands/cap are not yet explicitly confirmed beyond the known 0.25-band progression;
- exact auction position sequence will be chosen when the asta begins.

These do not block the current player pool or data-integrity work.
