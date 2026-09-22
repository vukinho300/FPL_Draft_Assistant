# FD2-QA2 verification

Base: merged FD2-QA on `origin/main` at `3d78ceb`. Worktree: isolated FD1 checkout.

The source files and snapshots are exactly the FD2-QA pins. No new acquisition or provider
research was performed. The final immutable local release is `fd2qa-2026-09-22-c8ce1b1e8b5f`.

## Commands run

```powershell
$env:FD2_SOURCE_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio'
$env:FD2_SNAPSHOT_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots'
& 'C:\Users\HT-ICT\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest discover -s research/fantacalcio/tests -v
```

Result: **25 passed, 0 skipped, in 14.940 seconds**. This includes five real-source tests,
strict same/future-season and target exclusions, current market/injury exclusions, prior event-window
admission, one-class-per-field manifest verification, split overlap, immutable output and two complete
byte-identical builds.

```powershell
& 'C:\Users\HT-ICT\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m research.fantacalcio.pipeline.release --source-root C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio --snapshot-root C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots --output-root research/fantacalcio/releases --reports research/fantacalcio/reports
```

Result: **PASS**; two complete builds compared byte for byte before the immutable write.
Pool 534; DQ 90.305; both readiness flags true; zero hard failures. Of 1,735 proposed
chronological samples, 1,735 pass the event-window certificate and zero are rejected. Another
943 target-season rows lack a prior-season source row and are outside this candidate design.

The previously pinned FD2-QA release and this release have identical `current_players.csv`,
`player_season.csv` and `identity_mapping.csv` SHA-256 hashes. The difficult source publication
metric remains zero. `RETROSPECTIVE_SOURCE_REVISION_RISK` remains a warning.

No model, prices, app, Supabase, production or Second Brain changes. No manual technical check
is required for this QA2 release. Product reuse/redistribution rights remain unresolved.
