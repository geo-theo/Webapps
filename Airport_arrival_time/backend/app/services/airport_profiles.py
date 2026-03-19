from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_airport_profile(airport_code: str) -> dict[str, Any]:
    project_root = Path(__file__).resolve().parents[3]
    profile_path = project_root / "shared-data" / "airports" / f"{airport_code.lower()}.json"
    with profile_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)

