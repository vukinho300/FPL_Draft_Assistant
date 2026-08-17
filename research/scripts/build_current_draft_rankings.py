from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from research.fpl_research.data import HistoricalRepository
from research.fpl_research.mvp_rankings import (
    MVP_ALPHA,
    MVP_FEATURE_GROUPS,
    MVP_MODEL,
    MVP_TRAINING_SEASONS,
    build_current_feature_rows,
    evaluate_mvp_model,
    load_draft_datasets,
    match_current_players,
    parse_current_bootstrap,
    train_and_predict_current,
)
from research.fpl_research.quality import require_benchmarkable_quality_gate


FPL_DRAFT_BOOTSTRAP = "https://draft.premierleague.com/api/bootstrap-static"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the current FPL Draft MVP model-signal artifact")
    parser.add_argument("--bootstrap-file", type=Path)
    parser.add_argument("--output", type=Path, default=Path("src/data/currentDraftRankingSignals.json"))
    parser.add_argument("--report", type=Path, default=Path("research/reports/mvp_draft_model_results.json"))
    return parser.parse_args()


def load_bootstrap(path: Path | None) -> object:
    if path is not None:
        return json.loads(path.read_text(encoding="utf-8"))
    request = Request(FPL_DRAFT_BOOTSTRAP, headers={"Accept": "application/json", "User-Agent": "FPL-Draft-Assistant/1"})
    with urlopen(request, timeout=30) as response:  # noqa: S310 - fixed project endpoint
        if response.status != 200:
            raise RuntimeError(f"FPL Draft bootstrap returned HTTP {response.status}")
        return json.load(response)


def main() -> None:
    args = parse_args()
    quality = require_benchmarkable_quality_gate(
        Path("research/reports/data_quality_results.json"),
        ("Vaastav FPL",),
        manifest_path=Path("research/data/source_manifest.json"),
    )
    sanity = json.loads(Path("research/reports/model_sanity_results.json").read_text(encoding="utf-8"))
    processed = Path("research/data/processed")
    development = load_draft_datasets(processed, ("2021-22", "2022-23", "2023-24", "2024-25"))
    evaluation = evaluate_mvp_model(development)
    evaluation.update(
        {
            "dataQualityStatus": quality["overall_status"],
            "leakageStatus": sanity["leakage_status"],
            "modelSanityStatus": sanity["model_sanity_status"],
        }
    )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(evaluation, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    raw_bootstrap = load_bootstrap(args.bootstrap_file)
    current = parse_current_bootstrap(raw_bootstrap)
    repository = HistoricalRepository(Path("research/data/raw"))
    matched, summary = match_current_players(current, repository.players("2025-26"))
    current_features = build_current_feature_rows(repository, matched, "2025-26", "2026-27")
    training = load_draft_datasets(processed, MVP_TRAINING_SEASONS)
    eligible = current_features.loc[
        current_features["identityStatus"].eq("EXACT") & current_features["history_missing"].eq(0)
    ].copy()
    if evaluation["modelSignalAvailable"] and not eligible.empty:
        predicted = train_and_predict_current(training, eligible)
        prediction_by_id = {str(row.draftPlayerId): row for row in predicted.itertuples(index=False)}
    else:
        prediction_by_id = {}

    players = []
    for row in matched.sort_values("draftPlayerId", key=lambda values: values.astype(int)).itertuples(index=False):
        prediction = prediction_by_id.get(str(row.draftPlayerId))
        available = prediction is not None
        reason = None
        if not available:
            reason = (
                "insufficient EPL history"
                if row.identityStatus in {"EXACT", "UNMATCHED"}
                else row.identityStatus.lower()
            )
        players.append(
            {
                "draftPlayerId": str(row.draftPlayerId),
                "modelPredictedSeasonPoints": round(float(prediction.prediction), 6) if available else None,
                "modelRank": int(prediction.modelRank) if available else None,
                "modelPositionRank": int(prediction.modelPositionRank) if available else None,
                "modelSignalAvailable": available,
                "unavailableReason": reason,
            }
        )

    generated_at = datetime.now(timezone.utc).isoformat()
    artifact = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "targetSeason": "2026-27",
        "priorSeason": "2025-26",
        "trainingSeasons": list(MVP_TRAINING_SEASONS),
        "model": "position-specific Ridge",
        "featureGroups": list(MVP_FEATURE_GROUPS),
        "alpha": MVP_ALPHA,
        "source": "FPL Draft bootstrap plus quality-approved Vaastav FPL history",
        "qualityStatus": quality["overall_status"],
        "leakageStatus": sanity["leakage_status"],
        "modelSanityStatus": sanity["model_sanity_status"],
        "playerCount": summary.current_player_count,
        "historicalMatchCount": summary.exact_historical_matches,
        "unmatchedCount": summary.unmatched,
        "ambiguousCount": summary.ambiguous,
        "conflictCount": summary.conflicts,
        "modelSignalCount": len(prediction_by_id),
        "modelSignalAvailable": bool(evaluation["modelSignalAvailable"]),
        "players": players,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({key: artifact[key] for key in ("playerCount", "historicalMatchCount", "unmatchedCount", "ambiguousCount", "conflictCount", "modelSignalCount", "modelSignalAvailable")}, indent=2))


if __name__ == "__main__":
    main()
