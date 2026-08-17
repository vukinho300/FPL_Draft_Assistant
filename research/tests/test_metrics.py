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


def test_error_metrics_are_zero_for_perfect_predictions():
    frame = pd.DataFrame({"season": ["A"] * 3, "target": [1, 2, 3], "prediction": [1, 2, 3]})
    metrics = evaluate_predictions(frame, ["season"])
    assert metrics["mae"] == 0
    assert metrics["rmse"] == 0


def test_reverse_partial_tied_and_constant_rankings_have_explicit_behavior():
    reverse = ranking_metrics([4, 3, 2, 1], [1, 2, 3, 4], (2,))
    assert reverse["spearman"] == pytest.approx(-1.0)
    assert reverse["ndcg_at_2"] < 1
    assert reverse["recall_at_2"] == 0

    partial_recall, partial_precision = top_k_metrics([4, 3, 2, 1], [4, 1, 3, 2], 2)
    assert partial_recall == partial_precision == 0.5

    tied = ranking_metrics([3, 3, 1], [2, 2, 1], (2,))
    assert tied["ndcg_at_2"] == pytest.approx(1.0)
    constant = ranking_metrics([3, 2, 1], [1, 1, 1], (5,))
    assert constant["spearman"] == 0
    assert constant["recall_at_5"] == 1
    assert constant["precision_at_5"] == 1


def test_evaluation_averages_rankings_by_cutoff():
    frame = pd.DataFrame(
        {"season": ["A"] * 4, "cutoff_gw": [1, 1, 2, 2], "target": [2, 1, 1, 2], "prediction": [2, 1, 1, 2]}
    )
    assert evaluate_predictions(frame, ["season", "cutoff_gw"])["spearman"] == pytest.approx(1.0)


def test_rank_metrics_are_averaged_by_decision_moment_not_globally():
    frame = pd.DataFrame(
        {
            "season": ["A"] * 6,
            "cutoff_gw": [1, 1, 1, 2, 2, 2],
            "target": [3, 2, 1, 3, 2, 1],
            "prediction": [3, 2, 1, 1, 2, 3],
        }
    )
    metrics = evaluate_predictions(frame, ["season", "cutoff_gw"])
    assert metrics["spearman"] == pytest.approx(0.0)
    assert 0 < metrics["ndcg_at_25"] < 1


def test_six_manager_metrics_use_project_position_demands():
    rows = []
    for position, count in (("GK", 15), ("DEF", 35), ("MID", 35), ("FWD", 20)):
        rows.extend({"position": position, "target": value, "prediction": value} for value in range(count))
    result = six_manager_metrics(pd.DataFrame(rows))
    assert dict(zip(result["position"], result["draft_pool_size"])) == {"GK": 12, "DEF": 30, "MID": 30, "FWD": 18}
    assert result["recall"].eq(1.0).all()


def test_six_manager_position_recall_handles_reverse_and_partial_rankings():
    reverse_rows = []
    partial_rows = []
    for position, demand in (("GK", 12), ("DEF", 30), ("MID", 30), ("FWD", 18)):
        eligible = demand * 2
        actual = list(range(eligible, 0, -1))
        reverse_rows.extend(
            {"position": position, "target": target, "prediction": -target} for target in actual
        )
        selected = list(range(demand // 2)) + list(range(demand, demand + demand // 2))
        prediction = [0.0] * eligible
        for rank, index in enumerate(selected):
            prediction[index] = float(eligible - rank)
        partial_rows.extend(
            {"position": position, "target": target, "prediction": predicted}
            for target, predicted in zip(actual, prediction)
        )
    reverse = six_manager_metrics(pd.DataFrame(reverse_rows))
    partial = six_manager_metrics(pd.DataFrame(partial_rows))
    assert reverse["recall"].eq(0.0).all()
    assert partial["recall"].eq(0.5).all()
