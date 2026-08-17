from pathlib import Path

import pandas as pd
import pytest

from research.fpl_research.identity import attach_fpl_code, build_understat_identity_evidence, canonical_person_name


def test_attach_fpl_code_uses_stable_code_without_mutating_inputs():
    gw = pd.DataFrame({"element": [1, 2], "total_points": [3, 4]})
    players = pd.DataFrame({"id": [1, 2], "code": [101, 202]})
    original = gw.copy(deep=True)
    result = attach_fpl_code(gw, players)
    assert result["code"].tolist() == [101, 202]
    pd.testing.assert_frame_equal(gw, original)


def test_attach_fpl_code_rejects_duplicate_identity():
    with pytest.raises(ValueError, match="unique"):
        attach_fpl_code(pd.DataFrame({"element": [1]}), pd.DataFrame({"id": [1, 2], "code": [7, 7]}))


def test_understat_mapping_accepts_only_unique_exact_names(tmp_path: Path):
    exact = tmp_path / "Mohamed_Salah_1250.csv"
    exact.write_text("date,xG\n2024-01-01,1\n", encoding="utf-8")
    players = pd.DataFrame(
        {"code": [11, 12], "first_name": ["Mohamed", "Different"], "second_name": ["Salah", "Player"]}
    )
    mapping, evidence = build_understat_identity_evidence("2023-24", players, [exact])
    assert mapping[["code", "external_id"]].to_dict("records") == [{"code": 11, "external_id": "1250"}]
    assert [item.status for item in evidence] == ["exact", "unmatched"]
    assert canonical_person_name("Mohamed Salah") == canonical_person_name("MOHAMED-SALAH")
