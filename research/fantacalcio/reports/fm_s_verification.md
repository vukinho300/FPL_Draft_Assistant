# FM-S verification — 2026-09-22

Worktree: `FPL_Draft_Assistant_FD1`. Branch: `research/fm-s-projection-release`, based on
merged FD2-QA2 main `f9000c9`. No app, Supabase, production or Second Brain changes.

## Executed tests

Using the bundled Python runtime and NumPy 2.3.5:

```powershell
$env:FD2_SOURCE_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio'
$env:FD2_SNAPSHOT_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots'
python -B -m unittest discover -s research/fantacalcio/tests -v
```

**35 tests passed, none skipped, 14.799 seconds.** This includes 25 existing data/temporal tests
and 10 new synthetic model tests. Synthetic test records never enter releases. New coverage checks
positive feature allowlisting, forbidden-field invariance, malformed events, separation of targets,
holdout exclusion during selection, training-only scaling, deterministic fitting, current shrinkage
weights, zero-appearance behavior and complete/ranked finite forecasts independent of benchmarks.
Existing tests cover same/future seasons, target-derived features, current FVM/quotation/injury
backfill rejection, admitted prior completed-season features and zero split overlap.

## Frozen experiment

Selection was saved before holdout evaluation. Final selection artifact:
`fms-selection-30a59dafd793/selection.json`.
SHA-256: `30a59dafd7937be276a95fc7410e84756607e994c8beada094876e68142bc16a`.

One final holdout configuration was evaluated, with no subsequent tuning or model-code changes.
The selected shrink_k30 remains selected despite naive's slightly better holdout MAE. Three controls
with 20 deterministic repeats each passed on validation. See `fm_s_report.json` for exact metrics.
The selection command and release command are documented in `../modelling/README.md`.

The selection reader filters seasons before parsing holdout/current outcomes. It hashes complete
input files to verify integrity; byte hashing is not use of their outcome values for selection.
After evaluation, all 1,735 historical samples fit the frozen configuration for the current forecast.
Current-season shrinkage is a separate approximation, not part of the historical metrics.

## Frozen artifact checks

Release: `fms-2026-09-22-b87cf673a837` in ignored local `releases/` storage.

- All eight release artifact checksums passed.
- All pinned FD2-QA2 source artifacts remained unchanged. Input checksum-manifest SHA-256:
  `61156f0da3869e6812dcda1622f0de03649eec2635087b9c6f1a2f2edd676dc2`.
- Selection bytes matched their immutable artifact and hash; model-code hashes remained unchanged.
- CSV and JSON each contain 534 players; exact ID set, names, clubs and roles match the input pool.
- Role counts: POR 63, DIF 190, CEN 194, ATT 87. Overall ranks are exactly 1–534; position ranks
  are contiguous and follow projection order.
- All numeric outputs are finite, expected remaining PV is in [0,33], probability in [0,1], and
  uncertainty bounds contain the point forecast. Serialized component products agree within 0.001.
- FVM and quotation benchmarks match input values and are excluded from predictions.
- Current projections generated twice within the release phase matched byte for byte. This checks
  the forecast serialization; it is not a claim that the entire holdout experiment was rerun twice.
- Tracked JSON/Markdown reports match the corresponding frozen manifest/report bytes.

The 80% validation error band covered 77.93% of holdout outcomes. Current bands and confidence labels
are heuristic, not calibrated for live use. Rights remain unresolved; no player-level artifacts or
fitted model parameters are committed. No auction prices were calculated.

Manual verification for Vuk: none required for this research audit. This is not production or
custom-league scoring certification. A later approved Second Brain update may record the release
and its limitations; no Second Brain files were edited.
