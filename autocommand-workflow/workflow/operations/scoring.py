"""
Vehicle scoring — pure arithmetic, no LLM.

Produces a VehicleScore for a given (Vehicle, CustomerProfile) pair. The score
captures multiple dimensions (price, condition, finance fit, etc.) and an
overall numeric score that bucketing uses to rank candidates.

This is the "Vehicle Scoring Agent" from the spec, implemented as math.
"""

from typing import Optional

from workflow.operations.market_values import market_value
from workflow.schemas import CustomerProfile, Vehicle, VehicleScore


CURRENT_YEAR = 2026


# ── Reference data (POC; replace with DB lookups later) ─────────────────────

# Dealer reliability: 0.0-1.0. Real version would use historical close-rate,
# customer complaints, response times, etc.
DEALER_RELIABILITY = {
    "acme-toyota-charlotte":    0.92,
    "raleigh-auto-direct":      0.81,
    "wilmington-used-cars":     0.74,
    "atlanta-premier-motors":   0.85,
    "tampa-bay-autoplex":       0.78,
    "charleston-coastal-cars":  0.82,
    "richmond-auto-hub":        0.79,
    "nashville-motors":         0.86,
    "autocommand-newbern":      0.98,    # we trust ourselves
}

# Credit-tier → APR for finance-fit math.
CREDIT_TIER_APR = {
    "excellent": 0.055,
    "good":      0.075,
    "fair":      0.105,
    "poor":      0.145,
    "unknown":   0.090,
}

# Flat shipping estimate. Production: distance × per-mile rate.
SHIPPING_COST_SAME_STATE      = 0.0
SHIPPING_COST_DIFFERENT_STATE = 800.0


# ── Helper math ─────────────────────────────────────────────────────────────


def monthly_payment(principal: float, apr: float, months: int = 60) -> float:
    """Standard amortization formula."""
    if apr <= 0:
        return principal / months
    r = apr / 12
    return principal * (r * (1 + r) ** months) / ((1 + r) ** months - 1)


def mileage_class(mileage: int, year: int) -> str:
    """Bucket the mileage relative to age-expected (~12k/yr)."""
    age = max(1, CURRENT_YEAR - year)
    expected = 12_000 * age
    ratio = mileage / expected
    if ratio < 0.6:  return "very_low"
    if ratio < 0.85: return "low"
    if ratio < 1.15: return "average"
    if ratio < 1.4:  return "high"
    return "very_high"


# ── Public scoring API ──────────────────────────────────────────────────────


def score_vehicle(v: Vehicle, profile: Optional[CustomerProfile] = None) -> VehicleScore:
    """
    Compute a VehicleScore for a single vehicle, optionally tailored to a customer.

    When `profile` is None, returns a generic score (no finance_fit, no shipping
    adjustment). This is what we cache on the vehicle at ingest time.
    """
    # ── Price vs market ────────────────────────────────────────────────────
    mv = market_value(v.make, v.model, v.year)
    price_vs_market = None
    if mv:
        price_vs_market = round(((v.asking_price - mv) / mv) * 100, 1)   # +5.0 = 5% over market

    # ── Condition signals ──────────────────────────────────────────────────
    mc = mileage_class(v.mileage, v.year)
    title_risk = v.title_status != "Clean"

    # ── Dealer reliability ─────────────────────────────────────────────────
    dealer_rel = DEALER_RELIABILITY.get(v.source_id, 0.70)

    # ── Shipping-adjusted cost ─────────────────────────────────────────────
    shipping = 0.0
    if profile and profile.location_state and v.location_state:
        if profile.location_state != v.location_state:
            shipping = SHIPPING_COST_DIFFERENT_STATE
    shipping_adj_cost = round(v.asking_price + shipping, 2)

    # ── Finance fit ────────────────────────────────────────────────────────
    finance_fit: Optional[bool] = None
    if profile and profile.max_monthly_payment:
        tier = profile.credit_tier_hint or "unknown"
        apr = CREDIT_TIER_APR.get(tier, CREDIT_TIER_APR["unknown"])
        payment = monthly_payment(v.asking_price, apr, months=60)
        finance_fit = payment <= profile.max_monthly_payment

    # ── Overall score (0-100) ──────────────────────────────────────────────
    overall = _composite_score(
        price_vs_market=price_vs_market,
        mileage_cls=mc,
        title_risk=title_risk,
        dealer_rel=dealer_rel,
        accident_count=v.accident_count or 0,
        finance_fit=finance_fit,
    )

    return VehicleScore(
        price_vs_market_pct=price_vs_market,
        mileage_class=mc,
        title_risk=title_risk,
        dealer_reliability=round(dealer_rel, 2),
        finance_fit=finance_fit,
        shipping_adjusted_cost=shipping_adj_cost,
        overall_score=overall,
    )


# ── Composite score ─────────────────────────────────────────────────────────


def _composite_score(
    *,
    price_vs_market: Optional[float],
    mileage_cls: str,
    title_risk: bool,
    dealer_rel: float,
    accident_count: int,
    finance_fit: Optional[bool],
) -> float:
    """
    Weighted 0-100 score. Each sub-score is normalized to 0-100, then combined.

    Weights:
      price       40%
      mileage     20%
      title       15%
      dealer       15%
      finance fit 10%
    """
    # Price (40%): centered at market value. -10% under → 100. +10% over → 0.
    if price_vs_market is None:
        price_score = 50.0
    else:
        # Linear: -10% under = 100, 0% = 70, +10% over = 40, +20% over = 10
        price_score = max(0.0, min(100.0, 70.0 - price_vs_market * 3.0))

    # Mileage (20%): 100/80/60/40/20 across the 5 classes
    mileage_score = {
        "very_low":  100.0,
        "low":        80.0,
        "average":    60.0,
        "high":       40.0,
        "very_high":  20.0,
    }[mileage_cls]

    # Title (15%): clean=100, any brand=20; minus 10 per accident
    title_score = 100.0 if not title_risk else 20.0
    title_score = max(0.0, title_score - 10.0 * accident_count)

    # Dealer (15%): 0..1 → 0..100
    dealer_score = dealer_rel * 100.0

    # Finance (10%): True=100, False=20, Unknown=70
    finance_score = (
        100.0 if finance_fit is True
        else 20.0 if finance_fit is False
        else 70.0
    )

    overall = (
        0.40 * price_score   +
        0.20 * mileage_score +
        0.15 * title_score   +
        0.15 * dealer_score  +
        0.10 * finance_score
    )
    return round(overall, 1)
