from __future__ import annotations

from collections.abc import Iterable

import numpy as np
import pandas as pd

from research.fpl_research.data import HistoricalRepository
from research.fpl_research.model_safety import make_sample_keys, validate_temporal_contract, validate_unique_samples
from research.fpl_research.odds import asof_team_features


BASE_STATS = (
    "total_points",
    "minutes",
    "starts",
    "goals_scored",
    "assists",
    "clean_sheets",
    "bonus",
    "bps",
    "saves",
    "yellow_cards",
    "red_cards",
)
EXPECTED_STATS = (
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "expected_goals_conceded",
)
ICT_STATS = ("influence", "creativity", "threat", "ict_index")
UNDERSTAT_STATS = ("xG", "xA", "npxG", "shots", "key_passes", "xGChain", "xGBuildup")

FEATURE_GROUPS: dict[str, tuple[str, ...]] = {
    "FPL_BASE": (
        "season_points_to_date",
        "season_minutes_to_date",
        "season_starts_to_date",
        "season_goals_to_date",
        "season_assists_to_date",
        "season_clean_sheets_to_date",
        "season_bonus_to_date",
        "season_bps_to_date",
        "season_saves_to_date",
        "history_missing",
        "low_minutes",
        "points_per90_shrunk",
    ),
    "FPL_EXPECTED": (
        "expected_goals_to_date",
        "expected_assists_to_date",
        "expected_goal_involvements_to_date",
        "expected_goals_conceded_to_date",
        "expected_fields_missing",
    ),
    "FPL_ICT": (
        "influence_to_date",
        "creativity_to_date",
        "threat_to_date",
        "ict_index_to_date",
        "ict_fields_missing",
    ),
    "FORM": (
        "last3_points",
        "last3_minutes",
        "last5_points",
        "last5_minutes",
        "last5_points_per_appearance",
    ),
    "TEAM_CONTEXT": ("team_shot_difference", "team_goal_difference", "team_context_matches"),
    "BOOKMAKER": ("bookmaker_market_strength",),
    "UNDERSTAT_PLAYER": (
        "understat_xg",
        "understat_xa",
        "understat_npxg",
        "understat_shots",
        "understat_key_passes",
        "understat_xg_chain",
        "understat_xg_buildup",
        "understat_matches",
        "understat_missing",
    ),
}

DRAFT_FEATURE_GROUPS: dict[str, tuple[str, ...]] = {
    name: tuple(column.replace("_to_date", "_prior") for column in columns)
    for name, columns in FEATURE_GROUPS.items()
}


def ensure_numeric(frame: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    result = frame.copy()
    for column in columns:
        if column not in result:
            result[column] = np.nan
        result[column] = pd.to_numeric(result[column], errors="coerce")
    return result


def aggregate_stats(frame: pd.DataFrame, group: str = "code") -> pd.DataFrame:
    columns = list(BASE_STATS + EXPECTED_STATS + ICT_STATS)
    numeric = ensure_numeric(frame, columns)
    return numeric.groupby(group, as_index=False)[columns].sum(min_count=1)


def gameweek_target_points(
    games: pd.DataFrame,
    *,
    cutoff_gw: int,
    horizon: int,
    player_codes: pd.Series,
    prediction_cutoff: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Sum future fixture rows in t < GW <= t+h, preserving DGWs and zero appearances."""
    if horizon not in (1, 3, 5):
        raise ValueError("target horizon must be 1, 3 or 5 gameweeks")
    if cutoff_gw < 0:
        raise ValueError("cutoff gameweek cannot be negative")
    required = {"code", "GW", "total_points"}
    if not required.issubset(games):
        raise ValueError(f"target construction missing fields: {sorted(required - set(games))}")
    future = games.loc[(games["GW"] > cutoff_gw) & (games["GW"] <= cutoff_gw + horizon)]
    if prediction_cutoff is not None:
        if "kickoff_time" not in future:
            raise ValueError("chronological target construction requires kickoff_time")
        cutoff = pd.Timestamp(prediction_cutoff)
        cutoff = cutoff.tz_localize("UTC") if cutoff.tzinfo is None else cutoff.tz_convert("UTC")
        kickoff = pd.to_datetime(future["kickoff_time"], errors="raise", utc=True)
        future = future.loc[kickoff > cutoff]
    totals = (
        ensure_numeric(future, ["total_points"])
        .groupby("code", as_index=False)["total_points"]
        .sum(min_count=1)
        .rename(columns={"total_points": "target"})
    )
    universe = pd.DataFrame({"code": pd.Series(player_codes).drop_duplicates()})
    result = universe.merge(totals, on="code", how="left", validate="one_to_one")
    result["target"] = result["target"].fillna(0.0)
    return result


def player_season_universe(gw1: pd.DataFrame) -> pd.DataFrame:
    """Reduce player-fixture GW1 grain to player-season after checking identity fields agree."""
    fields = ["code", "element", "name", "position", "team", "kickoff_time"]
    missing = [field for field in fields if field not in gw1]
    if missing:
        raise ValueError(f"GW1 player universe missing fields: {missing}")
    for field in ("element", "name", "position", "team"):
        if gw1.groupby("code", dropna=False)[field].nunique(dropna=False).gt(1).any():
            raise ValueError(f"GW1 player-fixture rows conflict on player-season field {field}")
    universe = gw1.sort_values(["code", "kickoff_time"]).groupby("code", as_index=False).first()[fields]
    universe["kickoff_time"] = gw1["kickoff_time"].min()
    return universe


def position_prior_rate(history: pd.DataFrame, position: str) -> float:
    candidates = history.loc[(history["position"] == position) & (history["minutes"] >= 450)].copy()
    if candidates.empty:
        candidates = history.loc[history["minutes"] >= 450].copy()
    if candidates.empty:
        return 3.0
    return float((candidates["total_points"] * 90 / candidates["minutes"]).median())


def _understat_aggregate(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=["code"])
    data = ensure_numeric(frame, UNDERSTAT_STATS)
    aggregate = data.groupby("code", as_index=False)[list(UNDERSTAT_STATS)].sum(min_count=1)
    counts = data.groupby("code").size().rename("understat_matches").reset_index()
    aggregate = aggregate.merge(counts, on="code", validate="one_to_one")
    return aggregate.rename(
        columns={
            "xG": "understat_xg",
            "xA": "understat_xa",
            "npxG": "understat_npxg",
            "shots": "understat_shots",
            "key_passes": "understat_key_passes",
            "xGChain": "understat_xg_chain",
            "xGBuildup": "understat_xg_buildup",
        }
    )


def build_draft_day_dataset(
    repository: HistoricalRepository,
    target_season: str,
    prior_season: str,
    include_understat: bool = True,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """One preseason row per GW1-registered player; current GW1 output is never a feature."""
    target_gw1 = repository.gw1(target_season)
    target_games = repository.gameweeks(target_season)
    prior_games = repository.gameweeks(prior_season)
    universe = player_season_universe(target_gw1)
    universe = universe.rename(columns={"kickoff_time": "cutoff_time"})
    target_start = pd.to_datetime(target_games["kickoff_time"], errors="raise", utc=True).min()
    target_end = pd.to_datetime(target_games["kickoff_time"], errors="raise", utc=True).max()
    prediction_cutoff = target_start - pd.Timedelta(nanoseconds=1)
    universe["cutoff_time"] = prediction_cutoff
    target = (
        ensure_numeric(target_games, ["total_points"])
        .groupby("code", as_index=False)["total_points"]
        .sum(min_count=1)
        .rename(columns={"total_points": "target"})
    )
    result = universe.merge(target, on="code", how="left", validate="one_to_one")
    result["target"] = result["target"].fillna(0.0)

    prior_latest = prior_games.sort_values(["code", "GW", "kickoff_time"]).drop_duplicates("code", keep="last")
    prior_aggregate = aggregate_stats(prior_games).merge(
        prior_latest[["code", "position", "team"]], on="code", how="left", validate="one_to_one"
    )
    prior_aggregate = prior_aggregate.rename(
        columns={
            "total_points": "season_points_prior",
            "minutes": "season_minutes_prior",
            "starts": "season_starts_prior",
            "goals_scored": "season_goals_prior",
            "assists": "season_assists_prior",
            "clean_sheets": "season_clean_sheets_prior",
            "bonus": "season_bonus_prior",
            "bps": "season_bps_prior",
            "saves": "season_saves_prior",
            "expected_goals": "expected_goals_prior",
            "expected_assists": "expected_assists_prior",
            "expected_goal_involvements": "expected_goal_involvements_prior",
            "expected_goals_conceded": "expected_goals_conceded_prior",
            "influence": "influence_prior",
            "creativity": "creativity_prior",
            "threat": "threat_prior",
            "ict_index": "ict_index_prior",
            "position": "prior_position",
            "team": "prior_team",
        }
    )
    result = result.merge(prior_aggregate, on="code", how="left", validate="one_to_one")
    result["history_missing"] = result["season_minutes_prior"].isna().astype(float)
    result["low_minutes"] = result["season_minutes_prior"].fillna(0).lt(450).astype(float)
    result["expected_fields_missing"] = result["expected_goal_involvements_prior"].isna().astype(float)
    result["ict_fields_missing"] = result["ict_index_prior"].isna().astype(float)

    prior_for_rates = prior_aggregate.rename(
        columns={"season_points_prior": "total_points", "season_minutes_prior": "minutes", "prior_position": "position"}
    )
    prior_rates = {position: position_prior_rate(prior_for_rates, position) for position in ("GK", "DEF", "MID", "FWD")}
    minutes = result["season_minutes_prior"].fillna(0.0)
    points = result["season_points_prior"].fillna(0.0)
    position_prior = result["position"].map(prior_rates).fillna(np.nanmedian(list(prior_rates.values())))
    result["points_per90_shrunk"] = (points + position_prior * 5.0) * 90.0 / (minutes + 450.0)

    prior_gw_values = sorted(prior_games["GW"].unique())
    last5 = prior_games.loc[prior_games["GW"].isin(prior_gw_values[-5:])]
    last3 = prior_games.loc[prior_games["GW"].isin(prior_gw_values[-3:])]
    for label, data in (("last5", last5), ("last3", last3)):
        sums = ensure_numeric(data, ["total_points", "minutes"]).groupby("code", as_index=False)[["total_points", "minutes"]].sum()
        sums = sums.rename(columns={"total_points": f"{label}_points", "minutes": f"{label}_minutes"})
        result = result.merge(sums, on="code", how="left", validate="one_to_one")
    result["last5_points_per_appearance"] = result["last5_points"].fillna(0.0) / 5.0

    prior_teams = set(prior_games["team"].dropna().astype(str))
    result["cold_start_category"] = np.where(
        result["history_missing"].eq(0),
        "RETURNING EPL PLAYER",
        np.where(result["team"].isin(prior_teams), "UNKNOWN", "PROMOTED-CLUB PLAYER"),
    )
    result = asof_team_features(result, repository.odds(prior_season))

    evidence = pd.DataFrame()
    if include_understat:
        understat, evidence = repository.understat(prior_season)
        result = result.merge(_understat_aggregate(understat), on="code", how="left", validate="one_to_one")
    for column in FEATURE_GROUPS["UNDERSTAT_PLAYER"]:
        prior_column = column.replace("_to_date", "_prior")
        if prior_column not in result:
            result[prior_column] = np.nan
    result["understat_missing"] = result.get("understat_matches", pd.Series(np.nan, index=result.index)).isna().astype(float)
    result["season"] = target_season
    result["task"] = "draft_day"
    result["horizon"] = 38
    result["prediction_cutoff"] = prediction_cutoff
    result["feature_max_timestamp"] = pd.to_datetime(prior_games["kickoff_time"], errors="raise", utc=True).max()
    result["target_start_timestamp"] = target_start
    result["target_end_timestamp"] = target_end
    result["sample_key"] = make_sample_keys(result, "draft_day")
    validate_temporal_contract(result)
    validate_unique_samples(result, "draft_day")
    return result, evidence


def _gameweek_player_rows(games: pd.DataFrame) -> pd.DataFrame:
    stats = list(BASE_STATS + EXPECTED_STATS + ICT_STATS)
    numeric = ensure_numeric(games, stats)
    sums = numeric.groupby(["code", "GW"], as_index=False)[stats].sum(min_count=1)
    latest = (
        games.sort_values(["code", "GW", "kickoff_time"])
        .drop_duplicates(["code", "GW"], keep="last")[["code", "GW", "team", "position", "kickoff_time"]]
    )
    return sums.merge(latest, on=["code", "GW"], validate="one_to_one")


def _understat_before(understat: pd.DataFrame, cutoff: pd.Timestamp, codes: pd.Series) -> pd.DataFrame:
    if understat.empty:
        return pd.DataFrame({"code": codes.unique()})
    cutoff_utc = pd.Timestamp(cutoff)
    cutoff_utc = cutoff_utc.tz_localize("UTC") if cutoff_utc.tzinfo is None else cutoff_utc.tz_convert("UTC")
    prior = understat.loc[understat["date"] <= cutoff_utc].sort_values(["code", "date"]).groupby("code").tail(10)
    return _understat_aggregate(prior)


def build_inseason_dataset(
    repository: HistoricalRepository,
    season: str,
    horizon: int,
    minimum_cutoff_gw: int = 5,
    include_understat: bool = True,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if horizon not in (1, 3, 5):
        raise ValueError("in-season horizon must be 1, 3 or 5 gameweeks")
    games = _gameweek_player_rows(repository.gameweeks(season))
    odds = repository.odds(season)
    understat, evidence = repository.understat(season) if include_understat else (pd.DataFrame(), pd.DataFrame())
    observed = sorted(int(value) for value in games["GW"].unique())
    maximum_observed_gw = max(observed)
    cutoffs = [value for value in observed if minimum_cutoff_gw <= value <= maximum_observed_gw - horizon]
    outputs: list[pd.DataFrame] = []
    for cutoff in cutoffs:
        known = games.loc[games["GW"] <= cutoff]
        prediction_cutoff = pd.to_datetime(known["kickoff_time"], errors="raise", utc=True).max()
        latest = known.sort_values(["code", "GW", "kickoff_time"]).drop_duplicates("code", keep="last")
        rows = latest[["code", "team", "position"]].copy()
        rows["cutoff_gw"] = cutoff
        rows["cutoff_time"] = prediction_cutoff
        cumulative = aggregate_stats(known)
        cumulative = cumulative.rename(
            columns={
                "total_points": "season_points_to_date",
                "minutes": "season_minutes_to_date",
                "starts": "season_starts_to_date",
                "goals_scored": "season_goals_to_date",
                "assists": "season_assists_to_date",
                "clean_sheets": "season_clean_sheets_to_date",
                "bonus": "season_bonus_to_date",
                "bps": "season_bps_to_date",
                "saves": "season_saves_to_date",
                "expected_goals": "expected_goals_to_date",
                "expected_assists": "expected_assists_to_date",
                "expected_goal_involvements": "expected_goal_involvements_to_date",
                "expected_goals_conceded": "expected_goals_conceded_to_date",
                "influence": "influence_to_date",
                "creativity": "creativity_to_date",
                "threat": "threat_to_date",
                "ict_index": "ict_index_to_date",
            }
        )
        rows = rows.merge(cumulative, on="code", validate="one_to_one")
        for window in (3, 5):
            recent = known.loc[known["GW"] > cutoff - window]
            sums = ensure_numeric(recent, ["total_points", "minutes"]).groupby("code", as_index=False)[["total_points", "minutes"]].sum()
            rows = rows.merge(
                sums.rename(columns={"total_points": f"last{window}_points", "minutes": f"last{window}_minutes"}),
                on="code",
                how="left",
                validate="one_to_one",
            )
        rows["last5_points_per_appearance"] = rows["last5_points"].fillna(0.0) / 5.0
        rows["history_missing"] = 0.0
        rows["low_minutes"] = rows["season_minutes_to_date"].fillna(0).lt(450).astype(float)
        rows["expected_fields_missing"] = rows["expected_goal_involvements_to_date"].isna().astype(float)
        rows["ict_fields_missing"] = rows["ict_index_to_date"].isna().astype(float)
        position_rates = {}
        for position in ("GK", "DEF", "MID", "FWD"):
            position_rates[position] = position_prior_rate(
                rows.rename(
                    columns={
                        "season_points_to_date": "total_points",
                        "season_minutes_to_date": "minutes",
                    }
                ),
                position,
            )
        prior = rows["position"].map(position_rates).fillna(3.0)
        rows["points_per90_shrunk"] = (
            rows["season_points_to_date"].fillna(0.0) + prior * 5.0
        ) * 90.0 / (rows["season_minutes_to_date"].fillna(0.0) + 450.0)

        target_window = games.loc[
            (games["GW"] > cutoff)
            & (games["GW"] <= cutoff + horizon)
            & (pd.to_datetime(games["kickoff_time"], errors="raise", utc=True) > prediction_cutoff)
        ]
        target = gameweek_target_points(
            games,
            cutoff_gw=cutoff,
            horizon=horizon,
            player_codes=rows["code"],
            prediction_cutoff=prediction_cutoff,
        )
        rows = rows.merge(target, on="code", validate="one_to_one")
        rows = asof_team_features(rows, odds)
        if include_understat:
            rows = rows.merge(_understat_before(understat, rows["cutoff_time"].iloc[0], rows["code"]), on="code", how="left")
        for column in FEATURE_GROUPS["UNDERSTAT_PLAYER"]:
            if column not in rows:
                rows[column] = np.nan
        rows["understat_missing"] = rows["understat_matches"].isna().astype(float)
        rows["season"] = season
        rows["task"] = "inseason"
        rows["horizon"] = horizon
        rows["prediction_cutoff"] = prediction_cutoff
        rows["feature_max_timestamp"] = prediction_cutoff
        if target_window.empty:
            # A league-wide blank horizon has a real zero target but no fixture timestamp.
            # The strict post-cutoff sentinel marks that empty interval without inventing an event.
            target_start = prediction_cutoff + pd.Timedelta(nanoseconds=1)
            target_end = target_start
        else:
            target_times = pd.to_datetime(target_window["kickoff_time"], errors="raise", utc=True)
            target_start = target_times.min()
            target_end = target_times.max()
        rows["target_has_observations"] = not target_window.empty
        rows["target_start_timestamp"] = target_start
        rows["target_end_timestamp"] = target_end
        rows["sample_key"] = make_sample_keys(rows, "inseason")
        validate_temporal_contract(rows)
        validate_unique_samples(rows, "inseason")
        outputs.append(rows)
    return pd.concat(outputs, ignore_index=True), evidence


def columns_for_groups(groups: Iterable[str], draft_day: bool = False) -> list[str]:
    source = DRAFT_FEATURE_GROUPS if draft_day else FEATURE_GROUPS
    columns: list[str] = []
    for group in groups:
        if group not in source:
            raise ValueError(f"unknown feature group: {group}")
        columns.extend(source[group])
    return list(dict.fromkeys(columns))
