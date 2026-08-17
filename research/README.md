# Phase 5/5A historical prediction research and data-quality gate

This directory is an offline research layer. It does not ship with the React app, change the production `Player` contract or implement Best Fit. Raw source data, processed datasets, virtual environments and fitted model artifacts are gitignored.

## Environment

Python 3.13.1 and the pinned direct dependencies in `requirements.txt` produced the committed results. From the repository root on Windows:

```powershell
python -m venv research/.venv
research/.venv/Scripts/python.exe -m pip install -r research/requirements.txt
```

Use `research/.venv/bin/python` on POSIX systems.

## Reproduce the full experiment

Run in this exact order:

```powershell
research/.venv/Scripts/python.exe -m research.scripts.fetch_data
research/.venv/Scripts/python.exe -m research.scripts.run_data_quality
research/.venv/Scripts/python.exe -m research.scripts.build_dataset
research/.venv/Scripts/python.exe -m research.scripts.run_data_quality
research/.venv/Scripts/python.exe -m research.scripts.run_development_benchmark
research/.venv/Scripts/python.exe -m research.scripts.select_holdout_candidate
research/.venv/Scripts/python.exe -m research.scripts.build_dataset --include-holdout
research/.venv/Scripts/python.exe -m research.scripts.run_data_quality
research/.venv/Scripts/python.exe -m research.scripts.run_holdout
```

`fetch_data` obtains a pinned Vaastav sparse checkout and six Football-Data CSVs, then writes `data/source_manifest.json` with URLs, timestamps, schemas and SHA-256 values. It accepts `--vaastav-source` and `--football-data-source` to import an already audited local cache. `run_data_quality` is a blocking prerequisite for building or benchmarking and writes `reports/data_quality_results.json` plus `reports/DATA_QUALITY_REPORT.md`. Rerunning it after a build adds processed-dataset row and missingness evidence. The holdout build still refuses to run until the frozen candidate config exists.

Run deterministic tests without network or full data:

```powershell
research/.venv/Scripts/python.exe -m pytest -c research/pyproject.toml research/tests
research/.venv/Scripts/python.exe -m compileall -q research/fpl_research research/scripts
```

## Boundaries

```text
Historical external data
        ↓
Research acquisition + provenance
        ↓
Blocking schema/grain/identity/join quality gate
        ↓
Leakage-safe historical features
        ↓
Chronological backtesting
        ↓
Evidence and a frozen holdout result
        ↓
Future production enrichment decision
```

The production web app neither imports this package nor installs pandas/scikit-learn. Research CI uses tiny local fixtures, never downloads seasons, never scrapes, never trains the full benchmark and needs no secrets.

## Result artifacts

- `reports/SOURCE_AUDIT.md`: availability, ownership, terms and source decisions.
- `reports/DATA_QUALITY_REPORT.md` and `data_quality_results.json`: blocking source/season status, exclusions, joins, references, drift, distributions, coverage and target evidence.
- `reports/DATA_DICTIONARY.md`: row, identity, feature and scoring-regime semantics.
- `reports/LEAKAGE_AUDIT.md`: cutoff rules and blocked feature paths.
- `reports/BENCHMARK_RESULTS.md`: actual development and holdout conclusions.
- `reports/ABLATION_RESULTS.md`: family removals and interpretation.
- `reports/PRODUCTION_RECOMMENDATION.md`: recommend/research/reject decisions.
- `reports/*.csv`: fold-level source, model, family, ablation, position, draft-pool, importance, cold-start and holdout results.
- `reports/quality_gate_benchmark_comparison.csv`: exact pre-gate versus corrected selected-holdout metric deltas.
- `configs/final_holdout_candidate.json`: candidate selected before 2025/26 evaluation.

Deterministic random seed: `20250817`. No trained model binary is committed. XGBoost, deep-learning frameworks and scraping dependencies are intentionally absent.

## Validation is not cleaning

Validation determines whether a dataset/configuration is trustworthy and can block it. Cleaning transforms values only after their meaning is established. The approved transformations are narrow and logged: remove only byte-equivalent player-fixture copies, normalize the documented legacy goalkeeper label, and exclude assistant-manager chip observations from the player dataset. Serious conflicts, broken references, join explosion, malformed domains, or stale provenance are not cleaned around.

The checked-in `final_holdout_candidate.json` remains the original pre-2025/26 Phase 5 choice. Phase 5A reruns that frozen choice against corrected data; it does not retune after viewing the holdout. The original artifact baseline is commit `bf5bc2c278b4138caade3251528bd10216ee9b5d`.
