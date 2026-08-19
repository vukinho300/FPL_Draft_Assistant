# Roadmap

Build in small dependency-ordered phases. Do not collapse these into one large Codex task.

## Must-have foundation
### F0 — Second Brain scaffold
Status: CURRENT
Result:
- concise project control manual;
- Codex read map;
- approved architecture/product decisions;
- no application-code changes.

### F1 — Vercel deployment
Goal:
Deploy the exact current `main` dashboard and existing `/api/fpl` boundary.

### F2 — Desktop + mobile responsive shell
Goal:
Preserve the current rich desktop experience while making the same season dashboard intentionally usable on phones. This is one application with shared data/domain logic and responsive presentation, not separate desktop/mobile products.

Acceptance direction:
- desktop sidebar and wide-screen layouts remain strong;
- mobile gets compact navigation and touch-friendly controls;
- pitch/squad views are readable at phone widths;
- grids/cards reflow cleanly;
- wide tables have intentional mobile handling;
- all seven main views remain usable on both form factors.

### F3 — Supabase foundation
Goal:
Introduce the minimum database/storage/auth infrastructure and migrations. No broad league features yet.

## League accounts
### A1 — Six accounts + RLS
- Pre-create six accounts.
- Team-name login UX.
- MEMBER / LEAGUE_OWNER authorization.
- Jakin Goff unique admin credentials.

### A2 — Account-aware shell
- Session identity available throughout app.
- My Team resolves to logged-in team.
- Appropriate admin/member UI derived from real permissions.

### A3 — Team profiles + avatars
- Team profile table.
- Avatar upload/update.
- Teams page consumes persistent profiles.

## Team / Gameweek tracking
### G1 — Real FPL Draft league/entry identity
- Obtain real league ID and six entry IDs safely.
- Verify league-specific read schemas.

### G2 — League standings adapter
- Real standings/current GW on League page.

### G3 — Lineup persistence/domain
- Draft lineup experimentation.
- Submit immutable-per-GW lineup record.
- Missing submission remains missing.

### G4 — Account-specific My Team Gameweek view
- Current squad.
- Submitted lineup/bench.
- Verified fixtures/status where available.

### G5 — Gameweek scoring
- Verified official total where available.
- Project-calculated total for submitted lineup where justified.
- Explicit source/provenance.

### G6 — Admin score corrections
- League-owner-only audited correction flow.

## Player improvements
### P1 — Premier League photo identity research
Prove the mapping/image contract before production implementation.

### P2 — Player photos
Use verified official Premier League mapping.

### P3 — Stats/status adapter
Add verified points, minutes, starts, availability/news, recent usage inputs.

### P4 — Usage classification
Project-derived labels such as regular starter/substitute/reduced minutes. Early/insufficient evidence -> Unknown.

### P5 — Players filtering/sorting
Official rank / MVP rank / model rank / free-agent filters and useful player detail.

## Transactions / trading
### T1 — Trading Block
Persistent user-owned list/unlist flow with RLS.

### T2 — Trade proposals
Send/respond/cancel proposals. Participant/admin visibility. No automatic roster mutation on acceptance.

### T3 — Player comparison
Shared player data used to answer "am I getting a good trade?"

### T4 — Real FPL transaction reconciliation
Observe verified FPL history/ownership and explicitly reconcile before marking project records PROCESSED.

## Later enhancements
### L1 — Start/bench assistant
Requires reliable lineup, fixtures, player status and recent-use data.

### L2 — Waiver/free-agent assistant
Requires reliable ownership/free-agent and player-value data.

### L3 — Trade-value model
Requires shared player projections/evidence and stable transaction foundations.

### L4 — Notifications
Only after useful events/triggers exist.

### L5 — Manager/season analytics
Examples:
- original draft value vs season result;
- best/worst draft selections;
- transaction value added;
- roster evolution;
- long-term league archive.

## Dependency rules
- User-facing features should normally work on both desktop and mobile before they are considered complete.
- Do not create separate desktop/mobile business logic or duplicate data sources.
- Do not build trade comparison before shared player enrichment exists.
- Do not build automatic/project scoring before lineup and player-GW contracts exist.
- Do not automate official FPL writes before read/reconciliation behavior is proven.
- Do not build recommendation AI on invented/unverified player status data.
- Do not let a later live feed overwrite immutable draft-day evidence.