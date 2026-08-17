from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


def canonical_person_name(value: str) -> str:
    """Conservative exact-name normalization; it is not fuzzy matching."""
    normalized = unicodedata.normalize("NFKC", str(value)).casefold()
    return "".join(character for character in normalized if character.isalnum())


def understat_filename_name(path: Path) -> str:
    return re.sub(r"_\d+$", "", path.stem).replace("_", " ")


@dataclass(frozen=True)
class IdentityEvidence:
    season: str
    fpl_code: int
    fpl_name: str
    external_id: str | None
    external_name: str | None
    status: str
    evidence: str


def attach_fpl_code(gw: pd.DataFrame, players_raw: pd.DataFrame) -> pd.DataFrame:
    """Map season-local `element` to stable FPL `code` without mutating inputs."""
    required_gw = {"element"}
    required_players = {"id", "code"}
    if not required_gw.issubset(gw.columns) or not required_players.issubset(players_raw.columns):
        raise ValueError("FPL identity mapping requires element, id and code columns")
    if players_raw["id"].duplicated().any() or players_raw["code"].duplicated().any():
        raise ValueError("FPL players_raw identity keys must be unique within a season")
    mapping = players_raw[["id", "code"]].rename(columns={"id": "element"}).copy()
    mapping["element"] = pd.to_numeric(mapping["element"], errors="raise").astype("int64")
    mapping["code"] = pd.to_numeric(mapping["code"], errors="raise").astype("int64")
    result = gw.copy()
    result["element"] = pd.to_numeric(result["element"], errors="raise").astype("int64")
    result = result.merge(mapping, on="element", how="left", validate="many_to_one")
    if result["code"].isna().any():
        raise ValueError("Every FPL gameweek element must map to a players_raw code")
    result["code"] = result["code"].astype("int64")
    return result


def build_understat_identity_evidence(
    season: str,
    players_raw: pd.DataFrame,
    understat_files: list[Path],
) -> tuple[pd.DataFrame, list[IdentityEvidence]]:
    """Accept unique exact normalized names only; ambiguity remains unmatched."""
    players = players_raw.copy()
    players["fpl_name"] = (
        players["first_name"].fillna("").astype(str).str.strip()
        + " "
        + players["second_name"].fillna("").astype(str).str.strip()
    ).str.strip()
    players["canonical_name"] = players["fpl_name"].map(canonical_person_name)

    external_rows = []
    for path in understat_files:
        external_name = understat_filename_name(path)
        match = re.search(r"_(\d+)$", path.stem)
        external_rows.append(
            {
                "external_id": match.group(1) if match else None,
                "external_name": external_name,
                "canonical_name": canonical_person_name(external_name),
                "path": str(path),
            }
        )
    external = pd.DataFrame(external_rows)
    if external.empty:
        return pd.DataFrame(columns=["code", "external_id", "path"]), []

    fpl_counts = players["canonical_name"].value_counts()
    external_counts = external["canonical_name"].value_counts()
    unique_fpl = players[players["canonical_name"].map(fpl_counts).eq(1)]
    unique_external = external[external["canonical_name"].map(external_counts).eq(1)]
    matches = unique_fpl.merge(unique_external, on="canonical_name", how="inner", validate="one_to_one")

    evidence: list[IdentityEvidence] = []
    matched_codes = set(matches["code"].astype(int))
    for row in players.itertuples(index=False):
        if int(row.code) in matched_codes:
            match_row = matches.loc[matches["code"].astype(int).eq(int(row.code))].iloc[0]
            evidence.append(
                IdentityEvidence(
                    season,
                    int(row.code),
                    row.fpl_name,
                    str(match_row.external_id),
                    str(match_row.external_name),
                    "exact",
                    "unique exact NFKC/casefold/alphanumeric-normalized full name",
                )
            )
        else:
            candidates = external.loc[external["canonical_name"].eq(row.canonical_name)]
            status = "ambiguous" if len(candidates) > 1 or fpl_counts.get(row.canonical_name, 0) > 1 else "unmatched"
            evidence.append(
                IdentityEvidence(season, int(row.code), row.fpl_name, None, None, status, "no unique exact match")
            )
    mapping = matches[["code", "external_id", "path"]].copy()
    mapping["code"] = mapping["code"].astype("int64")
    return mapping, evidence
