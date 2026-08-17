from __future__ import annotations

import re
from dataclasses import asdict
from pathlib import Path

import pandas as pd

from research.fpl_research.identity import attach_fpl_code, build_understat_identity_evidence
from research.fpl_research.odds import prepare_team_match_history
from research.fpl_research.quality import apply_approved_fpl_observation_rules, validate_gameweek_numbers


class HistoricalRepository:
    def __init__(self, raw_root: Path):
        self.raw_root = Path(raw_root)
        self._cache: dict[tuple[str, str], object] = {}

    def season_root(self, season: str) -> Path:
        return self.raw_root / "vaastav" / "data" / season

    def players(self, season: str) -> pd.DataFrame:
        key = ("players", season)
        if key not in self._cache:
            self._cache[key] = pd.read_csv(self.season_root(season) / "players_raw.csv", low_memory=False)
        return self._cache[key].copy()  # type: ignore[union-attr]

    def gw1(self, season: str) -> pd.DataFrame:
        raw = pd.read_csv(self.season_root(season) / "gws" / "gw1.csv", low_memory=False)
        approved, _, _ = apply_approved_fpl_observation_rules(raw, season=season, dataset="gw1")
        return attach_fpl_code(approved, self.players(season))

    def gameweeks(self, season: str) -> pd.DataFrame:
        key = ("gameweeks", season)
        if key in self._cache:
            return self._cache[key].copy()  # type: ignore[union-attr]
        raw = pd.read_csv(self.season_root(season) / "gws" / "merged_gw.csv", low_memory=False)
        frame, _, _ = apply_approved_fpl_observation_rules(raw, season=season, dataset="merged_gw")
        frame = attach_fpl_code(frame, self.players(season))
        if "GW" not in frame.columns:
            raise ValueError(f"{season} merged_gw.csv has no GW column")
        frame["GW"] = validate_gameweek_numbers(frame, "GW", f"FPL gameweeks {season}")
        frame["kickoff_time"] = pd.to_datetime(frame["kickoff_time"], utc=True, errors="raise")
        frame["team"] = frame["team"].astype(str)
        frame["position"] = frame["position"].astype(str)
        self._cache[key] = frame
        return frame.copy()

    def odds(self, season: str) -> pd.DataFrame:
        key = ("odds", season)
        if key not in self._cache:
            self._cache[key] = prepare_team_match_history(
                pd.read_csv(self.raw_root / "football_data" / f"{season}-E0.csv", low_memory=False)
            )
        return self._cache[key].copy()  # type: ignore[union-attr]

    def understat(self, season: str) -> tuple[pd.DataFrame, pd.DataFrame]:
        key = ("understat", season)
        if key in self._cache:
            data, evidence = self._cache[key]  # type: ignore[misc]
            return data.copy(), evidence.copy()
        understat_root = self.season_root(season) / "understat"
        files = (
            sorted(path for path in understat_root.glob("*.csv") if re.search(r"_(\d+)$", path.stem))
            if understat_root.exists()
            else []
        )
        mapping, evidence = build_understat_identity_evidence(season, self.players(season), files)
        evidence_frame = pd.DataFrame([asdict(item) for item in evidence])
        if mapping.empty:
            result = (pd.DataFrame(), evidence_frame)
            self._cache[key] = result
            return result[0].copy(), result[1].copy()
        frames: list[pd.DataFrame] = []
        for row in mapping.itertuples(index=False):
            path = Path(row.path)
            data = pd.read_csv(path, low_memory=False)
            data["code"] = int(row.code)
            data["understat_id"] = str(row.external_id)
            frames.append(data)
        result = pd.concat(frames, ignore_index=True)
        result["date"] = pd.to_datetime(result["date"], utc=True, errors="raise")
        self._cache[key] = (result, evidence_frame)
        return result.copy(), evidence_frame.copy()
