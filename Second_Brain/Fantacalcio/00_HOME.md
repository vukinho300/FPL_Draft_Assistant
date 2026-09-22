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

## Initial league assumptions

Current working configuration:
- managers: Achi, Massi, Gian, Francesco, Vuk, Dan, No Name, No Name 2;
- likely 8 managers, architecture should support 10;
- initial budget: 500 credits per manager, configurable;
- nomination rotates manager-by-manager;
- nomination includes a starting price;
- positions use POR / DIF / CEN / ATT;
- standard, inverted and arbitrary custom position sequences must be supported.

Exact squad composition and scoring rules remain Phase FA0 inputs and must not be silently invented.

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

## Current phase

**FA0 — Rules & architecture freeze** is the first implementation/research phase.

Before FD1 begins, exact league scoring/squad rules should be captured.

At **FD1**, perform dedicated deep research on Serie A/Fantacalcio APIs and data providers before selecting sources. Advanced statistics should be included only where their quality, licensing, coverage, timestamp semantics and predictive usefulness justify them.
