from __future__ import annotations

import pandas as pd


def join_elo_asof(rows: pd.DataFrame, ratings: pd.DataFrame) -> pd.DataFrame:
    """Leakage-safe synthetic-tested helper retained for a future clean ClubElo export."""
    left = rows.copy()
    right = ratings.copy()
    left["cutoff_time"] = pd.to_datetime(left["cutoff_time"], utc=True)
    right["rating_date"] = pd.to_datetime(right["rating_date"], utc=True)
    left["_input_order"] = range(len(left))
    left = left.sort_values(["cutoff_time", "team"])
    right = right.sort_values(["rating_date", "team"])
    merged = pd.merge_asof(
        left,
        right,
        left_on="cutoff_time",
        right_on="rating_date",
        by="team",
        direction="backward",
        allow_exact_matches=True,
    )
    if ((merged["rating_date"].notna()) & (merged["rating_date"] > merged["cutoff_time"])).any():
        raise AssertionError("future Elo rating joined to an earlier cutoff")
    return merged.sort_values("_input_order").drop(columns="_input_order").reset_index(drop=True)
