from __future__ import annotations

import argparse
import json
from pathlib import Path

from research.fpl_research.quality_gate import execute_quality_gate


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the blocking Phase 5A historical data-quality gate.")
    parser.add_argument("--raw-root", type=Path, default=Path("research/data/raw"))
    parser.add_argument("--manifest", type=Path, default=Path("research/data/source_manifest.json"))
    parser.add_argument("--processed-root", type=Path, default=Path("research/data/processed"))
    parser.add_argument("--output", type=Path, default=Path("research/reports/data_quality_results.json"))
    parser.add_argument("--report", type=Path, default=Path("research/reports/DATA_QUALITY_REPORT.md"))
    args = parser.parse_args()
    result = execute_quality_gate(
        args.raw_root,
        args.manifest,
        args.output,
        args.report,
        processed_root=args.processed_root if args.processed_root.exists() else None,
    )
    print(
        json.dumps(
            {
                "overall_status": result["overall_status"],
                "blocking_failures": result["blocking_failures"],
                "source_season_status": result["source_season_status"],
            },
            indent=2,
        )
    )
    if result["blocking_failures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
