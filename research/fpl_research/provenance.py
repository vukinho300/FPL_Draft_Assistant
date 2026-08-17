from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collection_sha256(paths: Iterable[Path], relative_to: Path) -> str:
    """Hash file names and bytes in stable path order."""
    digest = hashlib.sha256()
    for path in sorted(paths, key=lambda item: item.relative_to(relative_to).as_posix()):
        relative = path.relative_to(relative_to).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(sha256_file(path).encode("ascii"))
        digest.update(b"\0")
    return digest.hexdigest()


def observed_csv_columns(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig") as handle:
        first_line = handle.readline().rstrip("\r\n")
    return first_line.split(",") if first_line else []


def write_manifest(path: Path, entries: list[dict[str, object]], metadata: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
        "artifacts": entries,
    }
    path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")
