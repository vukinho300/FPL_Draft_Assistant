from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from research.fpl_research.features import gameweek_target_points
from research.fpl_research.quality import (
    DataQualityError,
    apply_approved_fpl_observation_rules,
    audit_duplicates,
    audit_join,
    compare_schema_signatures,
    coverage_record,
    historical_team_consistency,
    missingness_record,
    parse_required_dates,
    reconcile_aggregates,
    schema_signature,
    validate_finite_numeric,
    validate_gameweek_numbers,
    validate_nonnegative,
)


def test_gameweek_numbers_must_be_integral_and_within_official_range():
    valid = validate_gameweek_numbers(pd.DataFrame({"GW": [1, 10, 38]}))
    assert valid.tolist() == [1, 10, 38]
    assert str(valid.dtype) == "int64"

    for malformed in (1.5, 10.2, 37.9):
        with pytest.raises(DataQualityError, match="non-integral"):
            validate_gameweek_numbers(pd.DataFrame({"GW": [malformed]}))

    for out_of_range in (0, 39):
        with pytest.raises(DataQualityError, match="outside 1 through 38"):
            validate_gameweek_numbers(pd.DataFrame({"GW": [out_of_range]}))


def observation(**overrides):
    row = {
        "element": 1,
        "fixture": 10,
        "GW": 1,
        "position": "MID",
        "minutes": 90,
        "total_points": 5,
    }
    row.update(overrides)
    return row


def test_duplicate_audit_distinguishes_exact_logical_and_conflicting_rows():
    exact = pd.DataFrame([observation(), observation()])
    exact_result = audit_duplicates(exact, ("element", "fixture"))
    assert exact_result["exact_duplicate_excess_rows"] == 1
    assert exact_result["logical_duplicate_excess_rows"] == 1
    assert exact_result["conflicting_logical_duplicate_groups"] == 0

    conflicting = pd.DataFrame([observation(), observation(total_points=6)])
    conflict_result = audit_duplicates(conflicting, ("element", "fixture"))
    assert conflict_result["exact_duplicate_excess_rows"] == 0
    assert conflict_result["logical_duplicate_excess_rows"] == 1
    assert conflict_result["conflicting_logical_duplicate_groups"] == 1


def test_double_gameweek_is_valid_but_same_player_fixture_duplicate_is_not():
    double_gameweek = pd.DataFrame([observation(fixture=10), observation(fixture=11)])
    assert audit_duplicates(double_gameweek, ("element", "fixture"))["logical_duplicate_rows"] == 0
    approved, _, _ = apply_approved_fpl_observation_rules(
        double_gameweek, season="2024-25", dataset="gameweeks"
    )
    assert len(approved) == 2

    invalid = pd.DataFrame([observation(), observation(total_points=99)])
    with pytest.raises(DataQualityError, match="conflicting"):
        apply_approved_fpl_observation_rules(invalid, season="2024-25", dataset="gameweeks")


def test_exact_duplicate_exclusion_is_logged_and_input_is_not_mutated():
    frame = pd.DataFrame([observation(), observation()])
    original = frame.copy(deep=True)
    approved, reconciliation, transformations = apply_approved_fpl_observation_rules(
        frame, season="2025-26", dataset="gameweeks"
    )
    assert len(approved) == 1
    assert reconciliation[0].difference == -1
    assert transformations[0]["type"] == "exclusion"
    pd.testing.assert_frame_equal(frame, original)


def test_join_explosion_and_unjustified_many_to_many_are_blocked():
    left = pd.DataFrame({"id": [1], "value": ["left"]})
    repeated_right = pd.DataFrame({"id": [1, 1], "external": ["a", "b"]})
    with pytest.raises(DataQualityError, match="multiplied"):
        audit_join(
            left,
            repeated_right,
            on=("id",),
            expected="one_to_many",
            name="preserve-left test",
        )

    repeated_left = pd.DataFrame({"id": [1, 1]})
    with pytest.raises(DataQualityError, match="requires a documented justification"):
        audit_join(
            repeated_left,
            repeated_right,
            on=("id",),
            expected="many_to_many",
            name="unsafe mapping",
            preserve_left=False,
        )


def test_many_to_one_join_reports_exact_cardinality_counts():
    left = pd.DataFrame({"id": [1, 1, 2, 3]})
    right = pd.DataFrame({"id": [1, 2], "name": ["one", "two"]})
    output, audit = audit_join(
        left,
        right,
        on=("id",),
        expected="many_to_one",
        name="identity",
    )
    assert len(output) == len(left)
    assert audit["matched_left_rows"] == 3
    assert audit["unmatched_left_rows"] == 1
    assert audit["many_to_one_matches"] == 1
    assert audit["one_to_one_matches"] == 1


def test_known_position_rules_normalize_goalkeeper_and_exclude_assistant_manager():
    frame = pd.DataFrame(
        [observation(element=1, fixture=1, position="GKP"), observation(element=2, fixture=1, position="AM")]
    )
    approved, reconciliation, transformations = apply_approved_fpl_observation_rules(
        frame, season="2024-25", dataset="gameweeks"
    )
    assert approved["position"].tolist() == ["GK"]
    assert reconciliation[0].difference == -1
    assert {item["type"] for item in transformations} == {"normalization", "exclusion"}


def test_invalid_position_negative_minutes_malformed_date_and_nonfinite_values_fail():
    with pytest.raises(DataQualityError, match="invalid positions"):
        apply_approved_fpl_observation_rules(
            pd.DataFrame([observation(position="WINGER")]), season="2024-25", dataset="gameweeks"
        )

    with pytest.raises(DataQualityError, match="non-finite"):
        validate_finite_numeric(pd.DataFrame({"minutes": [np.inf]}), ("minutes",), "fixture rows")
    with pytest.raises(DataQualityError, match="non-finite"):
        validate_finite_numeric(pd.DataFrame({"minutes": ["not numeric"]}), ("minutes",), "fixture rows")
    with pytest.raises(DataQualityError, match="malformed"):
        parse_required_dates(pd.DataFrame({"date": ["not-a-date"]}), "date", "fixture rows")

    with pytest.raises(DataQualityError, match="negative minutes"):
        validate_nonnegative(pd.DataFrame([observation(minutes=-1)]), ("minutes",), "fixture rows")


def test_schema_drift_reports_added_removed_type_and_nullability_changes():
    previous = schema_signature(pd.DataFrame({"same": [1, 2], "removed": [1, 2], "type": [1, 2]}))
    current = schema_signature(pd.DataFrame({"same": [1, None], "added": [1, 2], "type": ["1", "2"]}))
    drift = compare_schema_signatures(
        previous,
        current,
        previous_season="2023-24",
        current_season="2024-25",
        dataset="test",
    )
    assert drift["fields_added"] == ["added"]
    assert drift["fields_removed"] == ["removed"]
    assert drift["observed_type_changes"] == ["type"]
    assert drift["nullability_changes"] == ["same"]


def test_missing_field_is_distinct_from_zero():
    frame = pd.DataFrame({"present": [0.0, np.nan]})
    present = missingness_record(frame, "present", season="A", position="MID", source="test")
    absent = missingness_record(frame, "absent", season="A", position="MID", source="test")
    assert present["field_existed"] is True
    assert present["missing"] == 1
    assert present["zero"] == 1
    assert absent["field_existed"] is False
    assert absent["missing"] == 2
    assert absent["zero"] == 0


def test_aggregate_reconciliation_and_coverage_are_exact():
    aggregate = reconcile_aggregates(pd.Series([10, 8]), pd.Series([10, 7]))
    assert aggregate["matching"] == 1
    assert aggregate["disagreements"] == 1
    assert aggregate["maximum_absolute_difference"] == 1

    coverage = coverage_record(
        pd.Series([True, True, True, False]),
        pd.Series([True, False, True, True]),
        season="2024-25",
        category="returning",
    )
    assert coverage["eligible"] == 3
    assert coverage["covered"] == 2
    assert coverage["coverage_rate"] == pytest.approx(2 / 3)


def test_target_horizons_are_gameweeks_and_preserve_dgw_bgw_and_no_appearance():
    games = pd.DataFrame(
        {
            "code": [1, 1, 1, 1],
            "GW": [5, 6, 6, 8],
            "fixture": [50, 60, 61, 80],
            "total_points": [1, 2, 3, 8],
        }
    )
    one = gameweek_target_points(games, cutoff_gw=5, horizon=1, player_codes=pd.Series([1, 2]))
    three = gameweek_target_points(games, cutoff_gw=5, horizon=3, player_codes=pd.Series([1, 2]))
    assert one.set_index("code").loc[1, "target"] == 5  # both GW6 fixtures
    assert three.set_index("code").loc[1, "target"] == 13  # blank GW7 adds nothing; GW8 is included
    assert one.set_index("code").loc[2, "target"] == 0  # no appearance remains in the universe


def test_cross_source_fixture_disagreement_is_detectable_by_exact_fact_join():
    fpl = pd.DataFrame(
        {"date": ["2024-01-01"], "home": ["Arsenal"], "away": ["Chelsea"], "home_score": [2], "away_score": [1]}
    )
    external = pd.DataFrame(
        {"date": ["2024-01-01"], "home": ["Arsenal"], "away": ["Chelsea"], "home_score_external": [1], "away_score_external": [1]}
    )
    joined, audit = audit_join(
        fpl,
        external,
        on=("date", "home", "away"),
        expected="one_to_one",
        name="match facts",
    )
    disagreement = joined["home_score"].ne(joined["home_score_external"])
    assert audit["matched_left_rows"] == 1
    assert int(disagreement.sum()) == 1


def test_broken_fixture_reference_and_historical_team_change_are_not_masked_by_current_team():
    observations = pd.DataFrame(
        {
            "fixture": [1, 2],
            "team_at_observation": [10, 20],
            "current_team": [20, 20],
        }
    )
    fixtures = pd.DataFrame({"fixture": [1], "home": [10], "away": [30]})
    _, audit = audit_join(
        observations,
        fixtures,
        on=("fixture",),
        expected="many_to_one",
        name="historical fixture membership",
    )
    assert audit["unmatched_left_rows"] == 1
    joined = pd.DataFrame(
        {
            "team": ["Old Club"],
            "opponent_team": [30],
            "was_home": [True],
            "GW": [1],
            "team_h": [10],
            "team_a": [30],
            "event": [1],
            "current_team": [20],
        }
    )
    teams = pd.DataFrame({"id": [10, 20, 30], "name": ["Old Club", "New Club", "Opponent"]})
    consistency = historical_team_consistency(joined, teams)
    assert consistency == {
        "historical_team_membership_disagreements": 0,
        "opponent_fixture_disagreements": 0,
        "gameweek_fixture_event_disagreements": 0,
    }
    assert joined["current_team"].iloc[0] != joined["team_h"].iloc[0]
