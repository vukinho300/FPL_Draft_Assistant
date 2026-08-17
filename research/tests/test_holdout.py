from __future__ import annotations

import hashlib
import json

import pytest

from research.scripts.run_holdout import read_frozen_config


def frozen_document(status: str = "SELECTED BEFORE HOLDOUT") -> dict[str, object]:
    body: dict[str, object] = {
        "schema_version": 1,
        "status": status,
        "selected_at": "2025-01-01T00:00:00+00:00",
        "development_results_sha256": "a" * 64,
        "locked_holdout_season": "2025-26",
        "tasks": {},
    }
    body["config_sha256"] = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    return body


def test_frozen_holdout_config_requires_original_hash_and_pre_holdout_status(tmp_path):
    path = tmp_path / "config.json"
    valid = frozen_document()
    path.write_text(json.dumps(valid), encoding="utf-8")
    assert read_frozen_config(path)["config_sha256"] == valid["config_sha256"]

    tampered = dict(valid)
    tampered["locked_holdout_season"] = "changed-after-selection"
    path.write_text(json.dumps(tampered), encoding="utf-8")
    with pytest.raises(ValueError, match="valid frozen"):
        read_frozen_config(path)

    wrong_status = frozen_document("RETUNED AFTER HOLDOUT")
    path.write_text(json.dumps(wrong_status), encoding="utf-8")
    with pytest.raises(ValueError, match="valid frozen"):
        read_frozen_config(path)
