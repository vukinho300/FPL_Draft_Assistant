from __future__ import annotations

import pandas as pd

from research.fpl_research.mvp_rankings import match_current_players, model_gate_satisfied, parse_current_bootstrap


def metrics(ndcg: float, spearman: float) -> dict[str, float]:
    return {"ndcg_at_25": ndcg, "spearman": spearman}


def test_model_gate_requires_signal_and_baseline_competitiveness() -> None:
    passing = [
        {"metrics": metrics(0.72, 0.51), "baselines": {"simple": metrics(0.76, 0.5)}},
        {"metrics": metrics(0.75, 0.55), "baselines": {"simple": metrics(0.77, 0.5)}},
    ]
    assert model_gate_satisfied(passing)
    failing = [*passing]
    failing[1] = {"metrics": metrics(0.59, 0.55), "baselines": {"simple": metrics(0.77, 0.5)}}
    assert not model_gate_satisfied(failing)


def test_current_identity_matching_is_exact_code_only() -> None:
    current = pd.DataFrame(
        [
            {"draftPlayerId": "1", "code": 101, "name": "Exact", "position": "MID"},
            {"draftPlayerId": "2", "code": 202, "name": "Same Name", "position": "FWD"},
            {"draftPlayerId": "3", "code": 303, "name": "Duplicate", "position": "DEF"},
        ]
    )
    historical = pd.DataFrame(
        [
            {"code": 101, "web_name": "Renamed"},
            {"code": 999, "web_name": "Same Name"},
            {"code": 303, "web_name": "Duplicate A"},
            {"code": 303, "web_name": "Duplicate B"},
        ]
    )
    matched, summary = match_current_players(current, historical)
    assert matched["identityStatus"].tolist() == ["EXACT", "UNMATCHED", "AMBIGUOUS"]
    assert summary.exact_historical_matches == 1
    assert summary.unmatched == 1
    assert summary.ambiguous == 1
    assert summary.conflicts == 0


def test_bootstrap_parser_uses_draft_id_and_stable_code_separately() -> None:
    frame = parse_current_bootstrap(
        {
            "element_types": [{"id": 3, "singular_name_short": "MID"}],
            "elements": [{"id": 7, "code": 7007, "web_name": "Player", "element_type": 3}],
        }
    )
    assert frame.loc[0, "draftPlayerId"] == "7"
    assert frame.loc[0, "code"] == 7007
