# Fantacalcio FD2-QA canonical release

Research-only source adapters and mandatory data-integrity gate. This package does not train a model,
rank players, calculate auction prices, modify the application, or connect to production.

## Selected inputs

- `0novanta/tool-asta-fantacalcio` at `5ec6e1afbee2ed7dd52c4fdb87595c242d13b8b2`:
  current quotation workbook, 2021/22–2026/27 fantasy-stat workbooks, all five advanced-stat families
  for those seasons, and the public SQLite artifact.
- `piopy/fantacalcio-py` at `4dda14a8dd2ab24c2f30404c65d317e1d4cc84a4`: inspected as reference
  only. No code copied. Its private provider, DNS override, fuzzy first-match joins and null-to-zero
  coercions are not used.
- Frozen public Fantacalcio quotation/statistics HTML pages acquired 2026-09-22. These supersede
  stale bootstrap current observations. Fantacalciopedia player/injury pages are smoke tests only.

Raw reference repositories and snapshots live outside project Git. Canonical player data lives in
the ignored `releases/` directory. Only our code, metadata, checksums and aggregate QA reports are
committed. Public GitHub availability does not establish third-party data rights; the local release
is **not cleared for redistribution or product reuse**.

## Reproduce offline

Python 3.11+ with `requirements.txt`; the audited environment used Python's standard library,
openpyxl 3.1.5 and lxml 6.1.1. No production dependencies were added.

From the isolated worktree root:

```powershell
python -B -m research.fantacalcio.pipeline.release `
  --source-root C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio `
  --snapshot-root C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots `
  --output-root research/fantacalcio/releases `
  --reports research/fantacalcio/reports
```

The sibling `fantacalcio-py` checkout must also be pinned. The source Git blobs, current page hashes
and snapshot-index metadata are checked. The release builder runs twice and compares every output
byte before writing. Existing releases are immutable; a conflicting rebuild fails. Code hashes are
part of provenance, so a changed transformation produces a new release ID.

The committed manifest cannot recreate historical web bytes from today's website. Preserve the
local snapshots for exact reruns. `pipeline.acquire_snapshots` can acquire a *new* bounded audit
snapshot; this requires a new selection-manifest hash and a new review, never silently replaces
the existing release. The source audit records the failed robots request as well as successful pages.

## Data choices

- Select one workbook `Tutti` sheet. Role sheets are redundant views and must not be concatenated.
  `Ceduti` is a separate excluded population. The newer live quotation page is the final pool
  authority; an explicit `out-of-game` marker means excluded. The statistics page does **not** expose
  that marker, so its absence cannot override eligibility.
- `playerRef = fantacalcio:fc:<numeric ID>` is deterministic and independent of names/clubs/roles.
  Classic P/D/C/A maps to POR/DIF/CEN/ATT. Current roles do not overwrite historical roles.
- The full historical source cohort is retained for potential chronological evaluation. Restricting
  historical samples to today's survivors would bias evaluation. Current-first mapping coverage is
  reported separately. `NEW_PLAYER_NO_HISTORY` means no matching ID in the five selected seasons,
  not proof of no career history. No name-only historical match is manufactured.
- PV means rated appearances, not all appearances. A source MV/FM of zero with PV=0 is retained in
  `raw_MV/raw_FM` and normalized to null with `NO_APPEARANCE`. Other missing numbers remain null;
  invalid strings/nonfinite/negative counts fail. Fantasy averages may legitimately be negative.
  The club in an FC season aggregate is a source label, not evidence of a club-specific stint;
  its statistics cover the player season. No total fantasy points are inferred from rounded
  averages. Penalty attempts/scored/missed and goalkeeper penalties saved stay separate.
- Advanced CSVs contain duplicate column labels for totals versus per-90 rates. The parser numbers
  column occurrences. Transfer observations use player/season/club keys. When a TOTAL exists, it is
  reconciled against distinct stints before selection; never added to them. Advanced data is audited
  but excluded from predictive features because the public SQLite lacks the Fantacalcio crosswalk.
- All selected football observations are season aggregates. Fixture and player-match coverage is
  `NOT_APPLICABLE — AGGREGATE SOURCE`, not a fictional 380/380 pass.

## Strict temporal gate

The current pinned historical files are proven available by the September 2026 source commit.
Their season labels do not prove publication before a 2022–2025 historical prediction cutoff.
Candidate samples are explicitly enumerated and rejected by the known-at-time guard. Historical
aggregates remain useful current-only evidence, but this release does not certify historical
backtesting. No old timestamps are invented.

Candidate chronological evaluation: target seasons 2022/23–2023/24 training, 2024/25 validation,
2025/26 untouched holdout; previous-season features only. Analytical target periods run July 1
through June 30, with a cutoff immediately before the target period. These are candidate boundaries,
not inferred fixture dates. Repeated players across seasons are allowed; duplicate sample keys or
overlapping observations are forbidden. No training occurs in this package.

Every field is classified BACKTEST_SAFE, CURRENT_ONLY, TARGET_ONLY or UNSAFE. Current FVM, clubs,
injuries and season aggregates are never backfilled into past folds. Target/future fields are denied.

## DQ scoring and readiness

The fixed component weights are 10 provenance, 10 schema, 20 identity/duplicates, 20 coverage,
15 consistency, 25 temporal safety. Each component equals its weight multiplied by the arithmetic
mean of named measured pass fractions in `data_quality_report.json`. Unknown checks receive zero.
Coverage includes actual historical mapping rate; expected missing history is not called a join
failure. Cross-source scoring explicitly withholds credit for complete independent-provider current
reconciliation, which was not performed. Historical publication-time proof receives zero credit.

`AUCTION_POOL_READY` evaluates only current identity/role/club/eligibility/provenance correctness.
`MODEL_READY` additionally requires score >=90, no hard failures, no temporal/target leakage and no
split overlap. Rejected candidate temporal violations are counted and block readiness even though
none enters an admitted feature matrix. A high score cannot waive them. Rights clearance is a
separate unresolved deployment concern and cannot be inferred from either technical flag.

## Tests

```powershell
$env:FD2_SOURCE_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\tool-asta-fantacalcio'
$env:FD2_SNAPSHOT_ROOT='C:\Users\HT-ICT\Documents\GitHub\fantacalcio_reference_sources\fd2qa_snapshots'
python -B -m unittest discover -s research/fantacalcio/tests -v
```

Without the two environment variables, real-source tests are skipped explicitly. The full audit
must run with both configured. Tests include malformed/ambiguous numeric values, duplicate IDs,
join multiplication, conflicting transfer totals, actual workbook schemas and stale/live snapshots,
missing critical fields, wrong seasons, leakage/denylist rejection, split overlap, score hard-failure
override and byte-identical offline reruns. Synthetic tests are labelled and never enter a release.

The next task is an independent gate review. Do not train a model from this release until the
reported temporal blockers are repaired or an explicitly reviewed evaluation design resolves them.
