# Phase 5 production recommendation

This is evidence for a future design phase, not production implementation. No Best Fit score, forecast service or player-selection state is introduced here.

## Recommend for live app

### Native FPL rolling history

Use verified points, minutes, starts, BPS and 3/5-GW form behind a future enrichment adapter. Form removal caused the largest consistent in-season ranking deterioration. Live access is already aligned with the existing FPL adapter, operational cost is low, and failure can degrade gracefully.

### Native FPL expected and ICT fields

Retain as candidate signals after the live contract verifies exact fields and timing. Expected goal involvement and BPS led permutation importance, and ICT helped draft ranking. These families overlap, so Phase 6 should expose facts rather than bake fixed weights into the Player model.

### Position-aware downstream modeling

Allow future recommendation research to vary by FPL position. Position-specific Ridge improved the primary NDCG selection metric in development. This is model context, not permission to add four production models in Phase 5.

## Research further

### Bookmaker/team context for preseason ranking

The quality-corrected fixed source test has draft FPL-only NDCG@25 0.678 versus 0.677 with team/bookmaker context; the earlier apparent +0.028 lift depended on an incomplete cross-provider team-name path. There is no longer evidence to add this source to production. A future fresh dataset could research it again only with complete exact team mappings, provable pre-deadline timestamps, and acceptable licensing.

### Cold-start enrichment

Promoted-club players had near-zero draft rank correlation. A future research phase should evaluate credible multi-league history or carefully timestamped preseason information. Do not translate foreign-league statistics without a verified model.

### 2025/26 scoring-regime adaptation

Defensive contribution, revised assists and BPS altered point generation. Accumulate another compatible season and test regime-aware models before using these new fields. Missing in prior seasons must not be represented as zero.

## Reject for now

### Understat ingestion

Incremental draft development gains were negligible/inconsistent, exact mapping covered only part of the player pool, and the audited Vaastav archive has no player-level 2020/21 or 2025/26 data. In-season Understat comparisons touching 2020/21 are now quality-blocked. Direct extraction would add maintenance and terms uncertainty without demonstrated unique value.

### ClubElo

All clean endpoint probes timed out and no clear redistribution terms were verified. Synthetic as-of join tests remain, but there is no executed evidence to justify production integration.

### Historical official Draft rank

No complete reproducible archive was found. Current official Draft rank may be evaluated later as a live baseline, but historical values must not be fabricated.

### Historical FDR, mutable availability and future closing odds

The archives do not prove their values at each FPL deadline. Exclude until timestamped snapshots exist.

### XGBoost, deep learning and scraping

Ridge already won development ranking comparisons; another compiled tree dependency was unnecessary. Dataset size does not justify deep learning. Clean selected sources were available without Scrapling, and optional-source absence was not a reason to bypass access controls.
