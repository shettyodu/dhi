"""
AutoCommand AI Marketplace — data schemas.

Two kinds of models in this module:

  - Persistent (SQLModel + table=True): rows stored in SQLite.
      Vehicle, Lead, SearchHistory

  - Transient (Pydantic BaseModel): API/agent inputs & outputs.
      CustomerProfile, VehicleScore, BucketedResults
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field as PField
from sqlalchemy import Column, JSON, Index
from sqlmodel import SQLModel, Field


# ────────────────────────────────────────────────────────────────────
#  Transient API / agent models (Pydantic only)
# ────────────────────────────────────────────────────────────────────


class CustomerProfile(BaseModel):
    """A normalized vehicle search profile.

    Produced either by binding a structured form, or by parsing free-form
    text via `nl_search_parser`. All fields optional — the agent (or form)
    fills in only what the customer specified.
    """
    # Identity
    make:          Optional[str] = None
    model:         Optional[str] = None
    trim:          Optional[str] = None
    body_style:    Optional[Literal[
        "Sedan", "SUV", "Truck", "Coupe", "Convertible",
        "Wagon", "Van", "Hatchback", "Minivan",
    ]] = None

    # Year & condition
    year_min:      Optional[int] = None
    year_max:      Optional[int] = None
    mileage_max:   Optional[int] = None

    # Money
    budget_min:    Optional[float] = None
    budget_max:    Optional[float] = None
    max_monthly_payment: Optional[float] = None

    # Powertrain
    fuel_type:     Optional[Literal[
        "Gasoline", "Hybrid", "Plug-in Hybrid",
        "Electric", "Diesel", "Flex Fuel",
    ]] = None
    drivetrain:    Optional[Literal["FWD", "RWD", "AWD", "4WD"]] = None
    transmission:  Optional[Literal["Automatic", "Manual", "CVT"]] = None

    # Location
    location_city:   Optional[str] = None
    location_state:  Optional[str] = None    # 2-letter
    location_zip:    Optional[str] = None

    # Shipping & sourcing
    accept_shipping:     Optional[bool] = None
    international:       Optional[bool] = None
    destination_country: Optional[str] = None  # ISO 3166

    # Trade-in
    trade_in_make:    Optional[str] = None
    trade_in_model:   Optional[str] = None
    trade_in_year:    Optional[int] = None
    trade_in_miles:   Optional[int] = None

    # Credit & financing
    wants_financing:   Optional[bool] = None
    credit_tier_hint:  Optional[Literal[
        "excellent", "good", "fair", "poor", "unknown"
    ]] = None

    # Protection
    wants_extended_warranty: Optional[bool] = None
    wants_gap:               Optional[bool] = None
    wants_tire_wheel:        Optional[bool] = None

    # Open-ended
    desired_features: List[str] = PField(default_factory=list)
    notes:            Optional[str] = None


class VehicleScore(BaseModel):
    """Output of the deterministic scoring operation for a vehicle."""
    price_vs_market_pct:    Optional[float] = None       # +5 = 5% over market
    mileage_class:          Optional[Literal[
        "very_low", "low", "average", "high", "very_high"
    ]] = None
    title_risk:             bool = False
    dealer_reliability:     Optional[float] = None       # 0-1
    finance_fit:            Optional[bool] = None
    shipping_adjusted_cost: Optional[float] = None
    overall_score:          Optional[float] = None       # 0-100
    recommendation_bucket:  Optional[Literal[
        "best_overall", "best_price", "best_local",
        "best_shipped", "best_warranty_fit",
        "best_export", "best_negotiation",
    ]] = None


class BucketedResults(BaseModel):
    """Search results organized into curated buckets for the UI."""
    best_overall:     List[str] = PField(default_factory=list)   # vehicle_ids
    best_price:       List[str] = PField(default_factory=list)
    best_local:       List[str] = PField(default_factory=list)
    best_shipped:     List[str] = PField(default_factory=list)
    best_negotiation: List[str] = PField(default_factory=list)
    total_count:      int = 0


# ────────────────────────────────────────────────────────────────────
#  Persistent models (SQLModel with table=True)
# ────────────────────────────────────────────────────────────────────


class Vehicle(SQLModel, table=True):
    """The canonical inventory record. Same shape regardless of source."""

    # ── Identity ────────────────────────────────────────────────────
    vehicle_id:      str = Field(primary_key=True)
    vin:             str = Field(index=True, unique=True)
    source_type:     str = Field(index=True)   # 'dealer_feed' | 'auction' | 'owned' | 'consignment'
    source_id:       str
    source_name:     Optional[str] = None

    # ── Specs ───────────────────────────────────────────────────────
    year:            int = Field(index=True)
    make:            str = Field(index=True)
    model:           str = Field(index=True)
    trim:            Optional[str] = None
    body_style:      Optional[str] = Field(default=None, index=True)
    mileage:         int = Field(index=True)
    exterior_color:  Optional[str] = None
    interior_color:  Optional[str] = None
    transmission:    Optional[str] = None
    drivetrain:      Optional[str] = Field(default=None, index=True)
    engine:          Optional[str] = None
    fuel_type:       Optional[str] = Field(default=None, index=True)
    mpg_city:        Optional[int] = None
    mpg_highway:     Optional[int] = None

    # ── Pricing ─────────────────────────────────────────────────────
    asking_price:           float = Field(index=True)
    estimated_otd_price:    Optional[float] = None
    market_value_estimate:  Optional[float] = None
    price_vs_market_pct:    Optional[float] = None

    # ── Condition & history ─────────────────────────────────────────
    title_status:    str = Field(default="Clean")
    accident_count:  Optional[int] = None
    owner_count:     Optional[int] = None
    carfax_summary:  Optional[str] = None
    recall_count:    Optional[int] = None
    condition_score: Optional[float] = None

    # ── Media (JSON columns) ────────────────────────────────────────
    photos:           List[str] = Field(default_factory=list, sa_column=Column(JSON))
    walkaround_video: Optional[str] = None
    features:         List[str] = Field(default_factory=list, sa_column=Column(JSON))
    description:      Optional[str] = None

    # ── Location ────────────────────────────────────────────────────
    location_city:         Optional[str] = None
    location_state:        Optional[str] = Field(default=None, index=True)
    location_zip:          Optional[str] = None
    is_on_autocommand_lot: bool = Field(default=False)

    # ── Scoring cache (JSON) ────────────────────────────────────────
    score:           Optional[dict] = Field(default=None, sa_column=Column(JSON))

    # ── Lifecycle ───────────────────────────────────────────────────
    status:            str = Field(default="active", index=True)   # active | pending_sale | sold | removed | stale
    listed_date:       datetime = Field(default_factory=datetime.utcnow)
    last_updated:      datetime = Field(default_factory=datetime.utcnow)
    last_seen_in_feed: Optional[datetime] = None

    __table_args__ = (
        Index("ix_vehicle_make_model_active", "make", "model", "status"),
        Index("ix_vehicle_price_active", "asking_price", "status"),
    )


class Lead(SQLModel, table=True):
    """A captured customer profile from a search submission."""
    lead_id:      str = Field(primary_key=True)
    profile_json: str                                         # serialized CustomerProfile
    source_query: Optional[str] = None                        # original NL text, if any
    created_at:   datetime = Field(default_factory=datetime.utcnow, index=True)


class SearchHistory(SQLModel, table=True):
    """One row per executed search — for debugging + future ML."""
    search_id:     str = Field(primary_key=True)
    lead_id:       Optional[str] = Field(default=None, foreign_key="lead.lead_id", index=True)
    profile_json:  str
    nl_input:      Optional[str] = None
    result_count:  int = 0
    duration_ms:   int = 0
    created_at:    datetime = Field(default_factory=datetime.utcnow, index=True)
