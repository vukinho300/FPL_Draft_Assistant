from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from research.fpl_research.provenance import collection_sha256, observed_csv_columns, sha256_file, write_manifest


SEASONS = ("2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26")
FOOTBALL_DATA_CODES = {
    "2020-21": "2021",
    "2021-22": "2122",
    "2022-23": "2223",
    "2023-24": "2324",
    "2024-25": "2425",
    "2025-26": "2526",
}
VAASTAV_URL = "https://github.com/vaastav/Fantasy-Premier-League.git"
VAASTAV_COMMIT = "8c97b2adb123863c3dd581e730f1360e89815ac2"


def import_vaastav(source: Path | None, destination: Path) -> str:
    if destination.exists():
        shutil.rmtree(destination)
    if source:
        if not (source / ".git").exists():
            raise ValueError("--vaastav-source must point to a Git checkout")
        shutil.copytree(source, destination, ignore=shutil.ignore_patterns(".git"))
        commit = subprocess.check_output(
            ["git", "-c", f"safe.directory={source.resolve()}", "rev-parse", "HEAD"], cwd=source, text=True
        ).strip()
        (destination / "SOURCE_COMMIT").write_text(commit + "\n", encoding="utf-8")
        return commit

    subprocess.run(
        ["git", "clone", "--filter=blob:none", "--sparse", "--no-checkout", VAASTAV_URL, str(destination)],
        check=True,
    )
    subprocess.run(["git", "sparse-checkout", "set", *[f"data/{season}" for season in SEASONS]], cwd=destination, check=True)
    subprocess.run(["git", "checkout", "--detach", VAASTAV_COMMIT], cwd=destination, check=True)
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=destination, text=True).strip()
    (destination / "SOURCE_COMMIT").write_text(commit + "\n", encoding="utf-8")
    return commit


def import_football_data(source: Path | None, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for season, code in FOOTBALL_DATA_CODES.items():
        target = destination / f"{season}-E0.csv"
        if source:
            shutil.copy2(source / target.name, target)
        else:
            url = f"https://www.football-data.co.uk/mmz4281/{code}/E0.csv"
            urllib.request.urlretrieve(url, target)


def manifest_entries(raw_root: Path, vaastav_commit: str) -> list[dict[str, object]]:
    retrieved_at = datetime.now(timezone.utc).isoformat()
    entries: list[dict[str, object]] = []
    for season in SEASONS:
        season_root = raw_root / "vaastav" / "data" / season
        for relative in ("gws/merged_gw.csv", "gws/gw1.csv", "players_raw.csv", "teams.csv", "fixtures.csv"):
            path = season_root / relative
            if not path.exists():
                continue
            entries.append(
                {
                    "source": "Vaastav FPL Historical Dataset",
                    "source_url": f"https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/{vaastav_commit}/data/{season}/{relative}",
                    "season": season,
                    "retrieved_at": retrieved_at,
                    "file_name": f"vaastav/data/{season}/{relative}",
                    "sha256": sha256_file(path),
                    "license_terms_note": "Repository code MIT; licence states underlying data belongs to FPL/Understat; raw file not committed.",
                    "acquisition_method": "pinned Git checkout",
                    "observed_columns": observed_csv_columns(path),
                    "transformation_history": ["none; raw local acquisition"],
                }
            )
        understat = list((season_root / "understat").glob("*.csv"))
        if understat:
            entries.append(
                {
                    "source": "Understat via Vaastav",
                    "source_url": f"https://github.com/vaastav/Fantasy-Premier-League/tree/{vaastav_commit}/data/{season}/understat",
                    "season": season,
                    "retrieved_at": retrieved_at,
                    "file_name": f"vaastav/data/{season}/understat/*.csv",
                    "file_count": len(understat),
                    "sha256": collection_sha256(understat, season_root / "understat"),
                    "license_terms_note": "Vaastav licence states Understat owns the data; raw collection not committed.",
                    "acquisition_method": "pinned Git checkout",
                    "observed_columns": observed_csv_columns(understat[0]),
                    "transformation_history": ["none; raw local acquisition", "collection digest includes relative paths and file digests"],
                }
            )
        odds_path = raw_root / "football_data" / f"{season}-E0.csv"
        entries.append(
            {
                "source": "Football-Data.co.uk",
                "source_url": f"https://www.football-data.co.uk/mmz4281/{FOOTBALL_DATA_CODES[season]}/E0.csv",
                "season": season,
                "retrieved_at": retrieved_at,
                "file_name": f"football_data/{odds_path.name}",
                "sha256": sha256_file(odds_path),
                "license_terms_note": "Site describes data as free for quantitative testing; no permissive redistribution licence identified; raw file not committed.",
                "acquisition_method": "HTTPS CSV download",
                "observed_columns": observed_csv_columns(odds_path),
                "transformation_history": ["none; raw local acquisition"],
            }
        )
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description="Acquire pinned historical research sources and write provenance metadata.")
    parser.add_argument("--raw-root", type=Path, default=Path("research/data/raw"))
    parser.add_argument("--manifest", type=Path, default=Path("research/data/source_manifest.json"))
    parser.add_argument("--vaastav-source", type=Path)
    parser.add_argument("--football-data-source", type=Path)
    args = parser.parse_args()
    args.raw_root.mkdir(parents=True, exist_ok=True)
    commit = import_vaastav(args.vaastav_source, args.raw_root / "vaastav")
    import_football_data(args.football_data_source, args.raw_root / "football_data")
    entries = manifest_entries(args.raw_root, commit)
    write_manifest(
        args.manifest,
        entries,
        {
            "vaastav_commit": commit,
            "seasons": list(SEASONS),
            "raw_data_committed": False,
            "scrapling_used": False,
        },
    )
    print(json.dumps({"vaastav_commit": commit, "manifest_entries": len(entries)}, indent=2))


if __name__ == "__main__":
    main()
