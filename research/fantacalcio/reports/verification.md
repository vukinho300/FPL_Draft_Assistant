# FD2-QA verification record

Executed 2026-09-22 in `C:\Users\HT-ICT\Documents\GitHub\FPL_Draft_Assistant_FD1`.
Base: `origin/main` at `da62976c5150ebef12aef9cb1944dfad5e0f7352`, including the five-hour sprint/data-integrity reset.
The existing clean FD1 checkout was reused; its previous work was retained on its original branch.
F2, the normal checkout, production and Second Brain were not modified.

## Automated checks actually run

```powershell
$env:FD2_SOURCE_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio'
$env:FD2_SNAPSHOT_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots'
& 'C:\Users\HT-ICT\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest discover -s research/fantacalcio/tests -v
```

Result: **24 tests passed in 14.536 seconds**, including all five real-source tests; none skipped.
Coverage includes invalid inputs, transfer totals, negative fantasy means versus negative counts,
source schema/season checks, excluded-current-player semantics, metadata tampering, temporal/target
rejection, split overlap, score thresholds, immutable writes and complete byte-identical rebuilds.

```powershell
& 'C:\Users\HT-ICT\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m research.fantacalcio.pipeline.release --source-root C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio --snapshot-root C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots --output-root research/fantacalcio/releases --reports research/fantacalcio/reports
```

Result: **PASS**, exit 0. Two complete builds compared equal byte for byte before writing.
Release: `fd2qa-2026-09-22-9a37da7d6ed5`.
Content digest: `9a37da7d6ed5f5cbdddf67840f9c3c5602d3a3ac578249abdbcb5cfce6a62517`.
534 current players; DQ 88.8764; pool ready; model blocked by historical as-of uncertainty.

## Source checks actually performed

Inspected actual pinned workbook sheets, headers and rows; all 30 selected advanced files;
SQLite integrity/schema/row counts/seasons/keys; source acquisition and matching code; public live
quotation/statistics snapshots and bounded Fantacalciopedia smoke pages. Snapshot index and every
used source artifact are hashed. Working source bytes are checked against pinned Git blobs.

The SQLite integrity check returned `ok`, but four omitted canonical tables prevent it from
providing a verified Fantacalcio-to-FBref mapping. Two public Fantacalciopedia pages loaded;
its robots request returned 404. Its stale/mixed-semantic enrichment was not admitted.

## Limits and manual verification for Vuk

No manual technical check is required for this audit. No app/UI, deployment or production test was
run because those surfaces were not changed. No model was trained. Exact reruns require the local
frozen web snapshots; today's live pages cannot recreate those bytes. Data reuse/redistribution,
league-specific vote edition and complete independent-provider reconciliation remain unverified.

Before modelling, independently review the gate and repair historical publication-time evidence.
The current pool is technically ready for FA3-DATA; technical readiness does not authorize data
redistribution or production reuse. No new paid provider was used.
