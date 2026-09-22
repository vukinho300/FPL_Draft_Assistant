# Fantacalcio — Architecture and Data

## Domain boundary

Fantacalcio shares platform infrastructure with FPL but has an independent football/auction domain.

Target dependency direction:

```text
External Serie A / Fantacalcio sources
        ↓
source-specific adapters
        ↓
immutable raw snapshots + provenance
        ↓
validated canonical player/match/role/injury data
        ↓
leakage-safe features
        ↓
versioned projection release
        ↓
auction economics engine
        ↓
Fantacalcio desktop UI
```

Raw provider shapes must not leak into React.

## Storage split

### Research/local analytical layer
Use a compact analytical store such as DuckDB/Parquet (or an evidence-supported alternative) for:
- multi-season historical data;
- feature construction;
- identity audits;
- walk-forward evaluation;
- model experiments.

Do not put the full research warehouse into production Supabase merely because Supabase exists.

### Supabase/product layer
Use Supabase for project-created operational state:
- Vuk-only capability/access;
- auction session;
- manager configuration;
- event ledger;
- purchases;
- current budgets/slots;
- compact current projection release and provenance where useful;
- backup/export metadata if needed.

## Canonical identity

Maintain a project-owned stable player ID.

External identities are mappings with:
- source;
- external ID;
- valid dates;
- match method;
- confidence;
- verification timestamp.

Names are never identity authority.

Quality gates must detect duplicate, ambiguous, missing or conflicting identities and fail closed for critical joins.

## Data layers

### Raw
Immutable source snapshots with:
- source/provider;
- retrieval timestamp;
- effective/observed timestamp where available;
- season;
- checksum;
- source/licensing note;
- schema/version.

### Canonical
Normalized:
- player;
- club;
- player-club stint;
- Fantacalcio role assignment;
- fixture;
- player-match;
- player-season;
- transfer;
- injury/suspension;
- lineup/playing-time evidence;
- tactical/set-piece evidence where reliable.

### Projection release
Every auction-facing evaluation should have:
- release ID;
- generated timestamp;
- data-as-of;
- training cutoff;
- data version;
- feature version;
- model version;
- scoring-rules version;
- quality status;
- warnings.

## Initial auction-cycle refresh policy

For the first official asta, prefer **one clean validated data/evaluation release** rather than building a large recurring refresh subsystem.

The current international-break context means continuous database/model refresh is not a high-priority requirement.

Still:
- record data-as-of and source timestamps;
- surface warnings/staleness;
- allow a deliberate rebuild if a material change occurs;
- never silently use a different snapshot after the auction release is frozen.

The auction should run against a known release ID.

## FD1 — source/API research requirement

FD1 begins with dedicated deep research because Serie A/Fantacalcio source availability differs materially from Premier League/FPL.

Research candidates for:
- official Fantacalcio roles, votes, fantamedia, quotations/FVM;
- Serie A player/match/minutes/lineup data;
- xG/xA and advanced attacking/defensive statistics;
- transfers;
- injuries/suspensions;
- probable lineups / starter evidence;
- penalties/set pieces / tactical role;
- historical seasons;
- historical auction-price evidence if legally/reliably available.

For every candidate source evaluate:
- coverage and historical depth;
- exact fields/grain;
- stable IDs;
- timestamp/as-of semantics;
- update latency;
- reliability;
- terms/license/redistribution;
- API cost and limits;
- reproducibility;
- value unique to the model.

Do not select advanced stats merely because they exist. They must have football justification and prove useful in leakage-safe evaluation.

Prefer a smaller set of coherent reliable providers over a fragile collection of scrapers when the engineering/licensing tradeoff supports it.


## First-auction source bootstrap — 5-hour sprint

The first auction release may bootstrap from existing community datasets/projects rather than rebuilding every source connector from zero, provided every artifact is pinned, checksummed, inspected and independently quality-gated.

Current evidence-supported source order:

1. **`0novanta/tool-asta-fantacalcio` — primary bootstrap candidate**
   - current 2026/27 Classic-oriented auction project;
   - Fantacalcio statistics/quotations files covering many seasons through 2026/27;
   - season-organized advanced football statistics;
   - a prebuilt public SQLite artifact;
   - useful as a fast bootstrap, **not automatically trusted as canonical truth**.

2. **`piopy/fantacalcio-py` — current-season enrichment/reference**
   - actively updated in September 2026;
   - contains current-season acquisition/merge logic using sources such as Understat/Fantacalciopedia and optional external providers;
   - reuse only source paths that pass a live smoke test and access/terms review;
   - do not depend on private credentials, brittle DNS workarounds or opaque external services merely because the project contains them.

3. **API-Football — fallback current feed**
   - use only if required current minutes/starts/injuries/identity cannot be established reliably from the bootstrap/current-source stack;
   - avoid adding paid/provider complexity unless it materially improves the release.

4. **`uPeppe/fantabeto` — modelling/historical methodology reference**
   - useful for vote/fantavote, goalkeeper separation, uncertainty and defense-modifier ideas;
   - its old scraping layer is not a 2026 production dependency.

Every external-repository artifact used must record:
- repository;
- exact commit SHA;
- file path;
- checksum;
- season;
- observed/retrieval time;
- original-source attribution where known;
- licensing/terms caveat;
- freshness warning.

Do not vendor entire external repositories or assume that a public GitHub file grants unrestricted redistribution rights. Prefer compact derived private-release artifacts and manifests.

## Data release readiness tiers

Data has two distinct readiness levels:

### AUCTION_POOL_READY
Enough to power canonical search/selection:
- current 2026/27 selectable identity is complete;
- Classic role is complete;
- club and eligibility are explicit;
- current identities are unique;
- provenance is pinned;
- no unresolved current-player collision exists.

### MODEL_READY
Required before any statistical projection is trusted:
- all AUCTION_POOL_READY gates pass;
- historical/current feature data passes the full integrity audit;
- critical duplicate/coverage/consistency checks pass;
- temporal leakage violations = 0;
- target leakage violations = 0;
- chronological split integrity passes;
- overall Data Quality Score meets the approved threshold.

A dataset may be AUCTION_POOL_READY but not MODEL_READY. In that case the recorder may use the real player pool, but statistical recommendations remain disabled.
