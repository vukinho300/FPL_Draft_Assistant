import pandas as pd
import pytest

from research.fpl_research.metrics import evaluate_predictions, ranking_metrics, six_manager_metrics, top_k_metrics


def test_top_k_metrics_find_exact_overlap():
    recall, precision = top_k_metrics([10, 9, 1, 0], [9, 10, 0, 1], 2)
    assert recall == precision == 1.0


def test_ranking_metrics_are_perfect_for_perfect_order():
    metrics = ranking_metrics([4, 3, 2, 1], [4, 3, 2, 1], (2,))
    assert metrics["spearman"] == pytest.approx(1.0)
    assert metrics["ndcg_at_2"] == pytest.approx(1.0)


def test_evaluation_averages_rankings_by_cutoff():
    frame = pd.DataFrame(
        {"season": ["A"] * 4, "cutoff_gw": [1, 1, 2, 2], "target": [2, 1, 1, 2], "prediction": [2, 1, 1, 2]}
    )
    assert evaluate_predictions(frame, ["season", "cutoff_gw"])["spearman"] == pytest.approx(1.0)


def test_six_manager_metrics_use_project_position_demands():
    rows = []
    for position, count in (("GK", 15), ("DEF", 35), ("MID", 35), ("FWD", 20)):
        rows.extend({"position": position, "target": value, "prediction": value} for value in range(count))
    result = six_manager_metrics(pd.DataFrame(rows))
    assert dict(zip(result["position"], result["draft_pool_size"])) == {"GK": 12, "DEF": 30, "MID": 30, "FWD": 18}
    assert result["recall"].eq(1.0).all()
