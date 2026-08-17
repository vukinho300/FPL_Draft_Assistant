# Phase 5/5A/5B historical prediction research and model-safety gates

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
research/.venv/Scripts/python.exe -m research.scripts.build_dataset --include-holdout
research/.venv/Scripts/python.exe -m research.scripts.run_data_quality
research/.venv/Scripts/python.exe -m research.scripts.run_development_benchmark
research/.venv/Scripts/python.exe -m research.scripts.run_holdout
research/.venv/Scripts/python.exe -m research.scripts.run_model_sanity
```

`fetch_data` obtains a pinned Vaastav sparse checkout and six Football-Data CSVs, then writes `data/source_manifest.json` with URLs, timestamps, schemas and SHA-256 values. It accepts audited local caches. `run_data_quality` is a blocking prerequisite and, after a build, adds processed temporal/sample evidence. The checked-in frozen config must exist before holdout targets are built. `select_holdout_candidate` documents the original pre-2025/26 selection workflow and must not be rerun to redefine a winner after exposure.

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
- `reports/MODEL_SANITY_REPORT.md` and `model_sanity_results.json`: real/shuffled/random controls, split evidence, metric validation, stability and trust status.
- `reports/*feature_manifests.json`: exact estimator inputs, metadata and forbidden fields.
- `reports/*split_audit*.json`: chronological row counts, unique keys and zero-overlap evidence.
- `reports/BENCHMARK_RESULTS.md`: actual development and holdout conclusions.
- `reports/ABLATION_RESULTS.md`: family removals and interpretation.
- `reports/PRODUCTION_RECOMMENDATION.md`: recommend/research/reject decisions.
- `reports/*.csv`: fold-level source, model, family, ablation, position, draft-pool, importance, cold-start and holdout results.
- `reports/quality_gate_benchmark_comparison.csv`: exact pre-gate versus corrected selected-holdout metric deltas.
- `configs/final_holdout_candidate.json`: candidate selected before 2025/26 evaluation.

Deterministic random seed: `20250817`. No trained model binary is committed. XGBoost, deep-learning frameworks and scraping dependencies are intentionally absent.

## Validation is not cleaning

Validation determines whether a dataset/configuration is trustworthy and can block it. Cleaning transforms values only after their meaning is established. The approved transformations are narrow and logged: remove only byte-equivalent player-fixture copies, normalize the documented legacy goalkeeper label, and exclude assistant-manager chip observations from the player dataset. Serious conflicts, broken references, join explosion, malformed domains, or stale provenance are not cleaned around.

The checked-in `final_holdout_candidate.json` remains the original pre-2025/26 Phase 5 choice. Phase 5A/5B rerun that frozen choice against corrected/validated data; they do not retune after viewing the holdout. The original artifact baseline is commit `bf5bc2c278b4138caade3251528bd10216ee9b5d`. For future families, 2025/26 is a previously exposed external benchmark; unseen 2026/27 data is required for prospective validation.
