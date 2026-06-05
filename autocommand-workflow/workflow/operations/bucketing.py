"""
Bucket scored vehicles into curated lists for the search-results UI.

Each bucket is a different ranking heuristic. A vehicle can appear in more
than one bucket — the UI shows them in separate rows, like Netflix categories.

This is the "Vehicle Scoring Agent: bucket curation" piece from the spec.
Plain Python, no LLM.
"""

from datetime import datetime
from typing import List, Optional, Tuple

from workflow.schemas import CustomerProfile, Vehicle, VehicleScore


BUCKET_SIZE = 5    # how many vehicles per bucket


# ── Public API ──────────────────────────────────────────────────────────────


def bucket_vehicles(
    scored: List[Tuple[Vehicle, VehicleScore]],
    profile: Optional[CustomerProfile] = None,
) -> dict:
    """
    Sort scored vehicles into curated buckets. Returns a dict ready for JSON.

    Schema returned (matching frontend expectations):
        {
          "total_count": int,
          "buckets": [
            {"key": "best_overall", "label": "Best Overall Match", "vehicles": [...]},
            {"key": "best_price",   "label": "Best Price",         "vehicles": [...]},
            ...
          ]
        }

    Each vehicle in the list is a dict with the full vehicle data + score
    attached, so the API can render result cards in one pass.
    """
    if not scored:
        return {"total_count": 0, "buckets": []}

    customer_state = profile.location_state if profile else None

    buckets = [
        ("best_overall",     "Best Overall Match",
            _sort_overall(scored)),
        ("best_price",       "Best Price",
            _sort_price(scored)),
        ("best_local",       "Best Local",
            _sort_local(scored, customer_state)),
        ("best_shipped",     "Best Shipped",
            _sort_shipped(scored, customer_state)),
        ("best_negotiation", "Best for Negotiation",
            _sort_negotiation(scored)),
    ]

    return {
        "total_count": len(scored),
        "buckets": [
            {"key": key, "label": label, "vehicles": [_vehicle_dict(v, s) for v, s in items]}
            for key, label, items in buckets
            if items
        ],
    }


# ── Sort heuristics per bucket ──────────────────────────────────────────────


def _sort_overall(scored):
    return sorted(scored, key=lambda x: -(x[1].overall_score or 0))[:BUCKET_SIZE]


def _sort_price(scored):
    """Cheapest relative to market value (most negative price_vs_market_pct first)."""
    have_market = [x for x in scored if x[1].price_vs_market_pct is not None]
    have_market.sort(key=lambda x: x[1].price_vs_market_pct)
    # Fall back to raw asking_price if too few have market values
    if len(have_market) < BUCKET_SIZE:
        rest = [x for x in scored if x[1].price_vs_market_pct is None]
        rest.sort(key=lambda x: x[0].asking_price)
        return (have_market + rest)[:BUCKET_SIZE]
    return have_market[:BUCKET_SIZE]


def _sort_local(scored, customer_state):
    """Vehicles in customer's state, ranked by overall score."""
    if not customer_state:
        # No state info → fall back to overall
        return _sort_overall(scored)
    local = [x for x in scored if x[0].location_state == customer_state]
    local.sort(key=lambda x: -(x[1].overall_score or 0))
    return local[:BUCKET_SIZE]


def _sort_shipped(scored, customer_state):
    """Out-of-state vehicles where total cost (incl. shipping) is best."""
    if not customer_state:
        return []
    shipped = [x for x in scored if x[0].location_state != customer_state]
    shipped.sort(key=lambda x: x[1].shipping_adjusted_cost or x[0].asking_price)
    return shipped[:BUCKET_SIZE]


def _sort_negotiation(scored):
    """High days-on-market = dealer more likely to negotiate."""
    now = datetime.utcnow()
    enriched = []
    for v, s in scored:
        days = (now - v.listed_date).days if v.listed_date else 0
        enriched.append((days, v, s))
    enriched.sort(key=lambda x: -x[0])
    # Only show vehicles listed >= 30 days to make this a meaningful signal
    enriched = [(d, v, s) for d, v, s in enriched if d >= 30]
    return [(v, s) for _, v, s in enriched[:BUCKET_SIZE]]


# ── Serialization helper ────────────────────────────────────────────────────


def _vehicle_dict(v: Vehicle, s: VehicleScore) -> dict:
    """Convert a Vehicle + VehicleScore pair into a JSON-friendly dict."""
    return {
        "vehicle_id":   v.vehicle_id,
        "vin":          v.vin,
        "year":         v.year,
        "make":         v.make,
        "model":        v.model,
        "trim":         v.trim,
        "body_style":   v.body_style,
        "mileage":      v.mileage,
        "exterior_color": v.exterior_color,
        "drivetrain":   v.drivetrain,
        "fuel_type":    v.fuel_type,
        "asking_price": v.asking_price,
        "title_status": v.title_status,
        "accident_count": v.accident_count,
        "owner_count":  v.owner_count,
        "photos":       v.photos or [],
        "features":     v.features or [],
        "location_city":  v.location_city,
        "location_state": v.location_state,
        "source_type":  v.source_type,
        "source_name":  v.source_name,
        "score":        s.model_dump(),
    }
