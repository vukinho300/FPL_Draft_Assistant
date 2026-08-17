from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from research.fpl_research.data import HistoricalRepository
from research.fpl_research.features import build_draft_day_dataset, build_inseason_dataset


DEVELOPMENT_SEASONS = ("2020-21", "2021-22", "2022-23", "2023-24", "2024-25")
DRAFT_PAIRS = (
    ("2021-22", "2020-21"),
    ("2022-23", "2021-22"),
    ("2023-24", "2022-23"),
    ("2024-25", "2023-24"),
)
HOLDOUT = "2025-26"


def write_identity_evidence(frames: list[pd.DataFrame], path: Path) -> None:
    usable = [frame for frame in frames if not frame.empty]
    combined = pd.concat(usable, ignore_index=True).drop_duplicates() if usable else pd.DataFrame()
    path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(path, index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build leakage-safe Phase 5 research datasets.")
    parser.add_argument("--raw-root", type=Path, default=Path("research/data/raw"))
    parser.add_argument("--output-root", type=Path, default=Path("research/data/processed"))
    parser.add_argument("--include-holdout", action="store_true")
    parser.add_argument("--frozen-config", type=Path, default=Path("research/configs/final_holdout_candidate.json"))
    args = parser.parse_args()
    if args.include_holdout and not args.frozen_config.exists():
        raise SystemExit("Refusing to build holdout targets before final_holdout_candidate.json exists")

    args.output_root.mkdir(parents=True, exist_ok=True)
    repository = HistoricalRepository(args.raw_root)
    evidence: list[pd.DataFrame] = []

    draft_pairs = list(DRAFT_PAIRS)
    if args.include_holdout:
        draft_pairs.append((HOLDOUT, "2024-25"))
    for target, prior in draft_pairs:
        print(f"building draft-day {target} from {prior}")
        dataset, identity = build_draft_day_dataset(repository, target, prior, include_understat=True)
        dataset.to_pickle(args.output_root / f"draft_day_{target}.pkl")
        evidence.append(identity)

    seasons = list(DEVELOPMENT_SEASONS)
    if args.include_holdout:
        seasons.append(HOLDOUT)
    for season in seasons:
        for horizon in (1, 3, 5):
            print(f"building in-season {season} horizon={horizon}")
            dataset, identity = build_inseason_dataset(repository, season, horizon, include_understat=True)
            dataset.to_pickle(args.output_root / f"inseason_h{horizon}_{season}.pkl")
            evidence.append(identity)

    write_identity_evidence(evidence, Path("research/reports/identity_matching_results.csv"))


if __name__ == "__main__":
    main()
