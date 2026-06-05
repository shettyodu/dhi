"""
Deterministic side-by-side vehicle comparison.

Given 2-5 vehicle IDs (and optionally a CustomerProfile), produce a structured
comparison object:
  - per-vehicle header data (photo, price, score)
  - rows grouped into sections (Key Metrics / Powertrain / Condition / etc.)
  - per-row winner index when the spec has a clear better-is-X direction

No LLM involved. The LLM-driven narrative lives in workflow/agents/comparison_narrative.py.
"""

from datetime import datetime
from typing import List, Optional

from sqlmodel import select

from workflow.db import session_scope
from workflow.operations.scoring import score_vehicle
from workflow.schemas import CustomerProfile, Vehicle


MIN_VEHICLES = 2
MAX_VEHICLES = 5


# ── Public API ──────────────────────────────────────────────────────────────


def compare_vehicles(
    vehicle_ids: List[str],
    profile: Optional[CustomerProfile] = None,
) -> dict:
    """
    Build a side-by-side comparison for 2-5 vehicles.

    Returns a JSON-serializable dict ready to feed into a template / API.
    Raises ValueError on bad input.
    """
    ids = list(dict.fromkeys(vehicle_ids))   # dedupe, preserve order
    if not (MIN_VEHICLES <= len(ids) <= MAX_VEHICLES):
        raise ValueError(
            f"compare needs {MIN_VEHICLES}-{MAX_VEHICLES} vehicles, got {len(ids)}"
        )

    # Fetch vehicles
    with session_scope() as s:
        rows = s.exec(select(Vehicle).where(Vehicle.vehicle_id.in_(ids))).all()
    by_id = {v.vehicle_id: v for v in rows}
    vehicles = [by_id[i] for i in ids if i in by_id]
    if len(vehicles) < MIN_VEHICLES:
        raise ValueError(f"only found {len(vehicles)} of {len(ids)} vehicles")

    # Score each (with customer context when provided)
    scored = [(v, score_vehicle(v, profile)) for v in vehicles]

    return {
        "vehicles": [_vehicle_header(v, s) for v, s in scored],
        "sections": _build_sections(scored, profile),
        "count":    len(vehicles),
    }


# ── Vehicle header (the card row at the top of the page) ────────────────────


def _vehicle_header(v: Vehicle, s) -> dict:
    return {
        "vehicle_id":   v.vehicle_id,
        "year":         v.year,
        "make":         v.make,
        "model":        v.model,
        "trim":         v.trim,
        "asking_price": v.asking_price,
        "photo":        (v.photos[0] if v.photos else None),
        "score":        s.overall_score,
        "location":     f"{v.location_city}, {v.location_state}" if v.location_city else v.location_state,
    }


# ── Section / row construction ──────────────────────────────────────────────


def _build_sections(scored, profile: Optional[CustomerProfile]) -> List[dict]:
    """
    Each section has rows. Each row has:
      {label, values, format, best_idx (or None), better ("higher"/"lower"/None)}
    """
    vs = [v for v, _ in scored]
    ss = [s for _, s in scored]

    def row(label, values, fmt, better):
        return _row(label, values, fmt, better)

    sections = [
        {
            "label": "Key Metrics",
            "rows": [
                row("Overall Score",       [s.overall_score for s in ss],            "score",  "higher"),
                row("Price",                [v.asking_price  for v in vs],            "money",  "lower"),
                row("Price vs Market",      [s.price_vs_market_pct for s in ss],     "percent", "lower"),
                row("Year",                 [v.year   for v in vs],                   "int",    "higher"),
                row("Mileage",              [v.mileage for v in vs],                  "miles",  "lower"),
            ],
        },
        {
            "label": "Powertrain",
            "rows": [
                row("Drivetrain",           [v.drivetrain   for v in vs], "text", None),
                row("Fuel Type",            [v.fuel_type    for v in vs], "text", None),
                row("Transmission",         [v.transmission for v in vs], "text", None),
                row("Body Style",           [v.body_style   for v in vs], "text", None),
            ],
        },
        {
            "label": "Condition & History",
            "rows": [
                row("Title Status",         [v.title_status   for v in vs],  "text",   None),
                row("Accidents",            [v.accident_count for v in vs],  "int",    "lower"),
                row("Previous Owners",      [v.owner_count    for v in vs],  "int",    "lower"),
                row("Open Recalls",         [v.recall_count   for v in vs],  "int",    "lower"),
                row("Mileage Class",        [s.mileage_class  for s in ss],  "text",   None),
            ],
        },
        {
            "label": "Match Fit",
            "rows": [
                row("Finance Fit",          [s.finance_fit             for s in ss], "bool",  "higher"),
                row("Shipping-Adj Cost",    [s.shipping_adjusted_cost  for s in ss], "money", "lower"),
                row("Dealer Reliability",   [s.dealer_reliability      for s in ss], "score01", "higher"),
            ],
        },
        {
            "label": "Listing",
            "rows": [
                row("Source Type",          [v.source_type.replace("_", " ") for v in vs], "text", None),
                row("Source Name",          [v.source_name or "—"  for v in vs], "text", None),
                row("Location",             [
                    f"{v.location_city}, {v.location_state}" if v.location_city else (v.location_state or "—")
                    for v in vs
                ], "text", None),
                row("Days on Market",       [_days_on_market(v) for v in vs], "int", None),
            ],
        },
        {
            "label": "Features",
            "rows": [
                row("Feature Count",        [len(v.features or []) for v in vs], "int", "higher"),
                row("Unique Features",      _unique_features_per_vehicle(vs),     "list", None),
                row("Shared Features",      [_shared_features(vs)] * len(vs),     "shared", None),
            ],
        },
    ]
    return sections


# ── Row helpers ─────────────────────────────────────────────────────────────


def _row(label, values, fmt, better):
    return {
        "label":  label,
        "values": list(values),
        "format": fmt,
        "better": better,                # "higher" | "lower" | None
        "best_idx": _best_idx(values, better),
    }


def _best_idx(values, better):
    """Return index of best value, or None if no clear winner / direction."""
    if better is None:
        return None
    numeric = [(i, v) for i, v in enumerate(values) if isinstance(v, (int, float))]
    if not numeric:
        return None

    if better == "higher":
        best = max(numeric, key=lambda x: x[1])
    else:
        best = min(numeric, key=lambda x: x[1])

    # Tie detection — if multiple share the best value, no clear winner
    if sum(1 for _, val in numeric if val == best[1]) > 1:
        return None
    return best[0]


def _days_on_market(v: Vehicle) -> int:
    if not v.listed_date:
        return 0
    return max(0, (datetime.utcnow() - v.listed_date).days)


def _shared_features(vs: List[Vehicle]) -> List[str]:
    """Features common to ALL compared vehicles."""
    if not vs:
        return []
    sets = [set(v.features or []) for v in vs]
    return sorted(set.intersection(*sets))


def _unique_features_per_vehicle(vs: List[Vehicle]) -> List[List[str]]:
    """For each vehicle, features it has that NO other compared vehicle has."""
    if not vs:
        return []
    all_sets = [set(v.features or []) for v in vs]
    out = []
    for i, my_set in enumerate(all_sets):
        others = set().union(*(s for j, s in enumerate(all_sets) if j != i))
        out.append(sorted(my_set - others))
    return out
