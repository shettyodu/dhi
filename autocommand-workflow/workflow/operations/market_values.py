"""
Market-value lookups backed by fixtures/market_values.json.

POC: hand-curated table. Production: replace with KBB / Manheim Market Report API.
"""

import json
from pathlib import Path
from typing import Optional


_MARKET_VALUES_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "market_values.json"

_TABLE: Optional[dict] = None       # {(make, model, year): market_value}


def _load() -> dict:
    """Load the market_values.json table once and cache it."""
    global _TABLE
    if _TABLE is not None:
        return _TABLE
    raw = json.loads(_MARKET_VALUES_PATH.read_text())
    _TABLE = {
        (row["make"], row["model"], row["year"]): float(row["market_value"])
        for row in raw["values"]
    }
    return _TABLE


def market_value(make: str, model: str, year: int) -> Optional[float]:
    """
    Look up the fair market value for a (make, model, year). Returns None
    if the entry is missing. Caller decides how to handle missing values.
    """
    table = _load()
    return table.get((make, model, year))
