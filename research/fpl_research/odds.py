from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd


TEAM_ALIASES = {
    "Man United": "Manchester Utd",
    "Man City": "Manchester City",
    "Nott'm Forest": "Nottingham Forest",
    "Spurs": "Tottenham",
    "Wolves": "Wolverhampton",
}


def canonical_team_name(value: str) -> str:
    return TEAM_ALIASES.get(str(value).strip(), str(value).strip())


def normalized_implied_probabilities(odds: Iterable[float]) -> np.ndarray:
    values = np.asarray(list(odds), dtype=float)
    if values.shape != (3,) or not np.isfinite(values).all() or (values <= 1).any():
        raise ValueError("home/draw/away decimal odds must be three finite values greater than 1")
    inverse = 1.0 / values
    return inverse / inverse.sum()


def prepare_team_match_history(matches: pd.DataFrame) -> pd.DataFrame:
    required = {"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "HS", "AS", "AvgH", "AvgD", "AvgA"}
    if not required.issubset(matches.columns):
        raise ValueError(f"Football-Data input missing columns: {sorted(required - set(matches.columns))}")
    frame = matches.copy()
    frame["match_date"] = pd.to_datetime(frame["Date"], dayfirst=True, errors="raise", utc=True)
    numeric = ["FTHG", "FTAG", "HS", "AS", "AvgH", "AvgD", "AvgA"]
    frame[numeric] = frame[numeric].apply(pd.to_numeric, errors="raise")
    probabilities = np.vstack(
        [normalized_implied_probabilities(row) for row in frame[["AvgH", "AvgD", "AvgA"]].itertuples(index=False, name=None)]
    )
    frame[["market_home", "market_draw", "market_away"]] = probabilities

    home = pd.DataFrame(
        {
            "match_date": frame["match_date"],
            "team": frame["HomeTeam"].map(canonical_team_name),
            "market_win_probability": frame["market_home"],
            "goals_for": frame["FTHG"],
            "goals_against": frame["FTAG"],
            "shots_for": frame["HS"],
            "shots_against": frame["AS"],
        }
    )
    away = pd.DataFrame(
        {
            "match_date": frame["match_date"],
            "team": frame["AwayTeam"].map(canonical_team_name),
            "market_win_probability": frame["market_away"],
            "goals_for": frame["FTAG"],
            "goals_against": frame["FTHG"],
            "shots_for": frame["AS"],
            "shots_against": frame["HS"],
        }
    )
    result = pd.concat([home, away], ignore_index=True).sort_values(["team", "match_date"])
    result["shot_difference"] = result["shots_for"] - result["shots_against"]
    result["goal_difference"] = result["goals_for"] - result["goals_against"]
    return result.reset_index(drop=True)


def team_features_before(history: pd.DataFrame, team: str, cutoff: pd.Timestamp, window: int = 10) -> dict[str, float]:
    canonical = canonical_team_name(team)
    cutoff_utc = pd.Timestamp(cutoff)
    cutoff_utc = cutoff_utc.tz_localize("UTC") if cutoff_utc.tzinfo is None else cutoff_utc.tz_convert("UTC")
    prior = history.loc[(history["team"] == canonical) & (history["match_date"] < cutoff_utc)].tail(window)
    if prior.empty:
        return {
            "bookmaker_market_strength": np.nan,
            "team_shot_difference": np.nan,
            "team_goal_difference": np.nan,
            "team_context_matches": 0.0,
        }
    return {
        "bookmaker_market_strength": float(prior["market_win_probability"].mean()),
        "team_shot_difference": float(prior["shot_difference"].mean()),
        "team_goal_difference": float(prior["goal_difference"].mean()),
        "team_context_matches": float(len(prior)),
    }


def asof_team_features(rows: pd.DataFrame, history: pd.DataFrame, window: int = 10) -> pd.DataFrame:
    result = rows.copy()
    values = [team_features_before(history, row.team, row.cutoff_time, window) for row in result.itertuples()]
    return pd.concat([result.reset_index(drop=True), pd.DataFrame(values)], axis=1)
