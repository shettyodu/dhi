"""
AutoCommand fixture seeder.

Generates ~100 realistic vehicles drawn from a curated template set, writes them
to `dealer_feed.json`, and loads them into the SQLite DB. Designed for POC use;
production data comes from real dealer feeds.

CLI:
    python -m workflow.fixtures.seed              # default: load (generate if missing)
    python -m workflow.fixtures.seed generate     # rewrite dealer_feed.json
    python -m workflow.fixtures.seed load         # load existing dealer_feed.json
    python -m workflow.fixtures.seed reset        # wipe + regenerate + reload

Determinism: a fixed RNG seed makes generation reproducible across runs.
"""

import argparse
import json
import random
import string
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from sqlmodel import select

from workflow.db import engine, init_db, session_scope
from workflow.logging_utils import configure_logging, log_info, log_warning
from workflow.schemas import Vehicle


FIXTURES_DIR = Path(__file__).parent
DEALER_FEED_PATH   = FIXTURES_DIR / "dealer_feed.json"
MARKET_VALUES_PATH = FIXTURES_DIR / "market_values.json"

CURRENT_YEAR = 2026


# ────────────────────────────────────────────────────────────────────
#  Reference data — make/model templates, dealers, etc.
# ────────────────────────────────────────────────────────────────────

# (make, model, body_style, drivetrain, fuel_type, new_msrp, common_trims, common_features)
TEMPLATES = [
    # ── Toyota ─────────────────────────────────────────────────────
    ("Toyota", "Highlander", "SUV",   "AWD", "Gasoline", 42000,
        ["LE", "XLE", "Limited", "Platinum"],
        ["Heated Seats", "Apple CarPlay", "Sunroof", "Third Row Seating"]),
    ("Toyota", "Camry",      "Sedan", "FWD", "Gasoline", 28000,
        ["LE", "SE", "XLE", "XSE"],
        ["Apple CarPlay", "Android Auto", "Lane Keep Assist"]),
    ("Toyota", "Tacoma",     "Truck", "4WD", "Gasoline", 36000,
        ["SR5", "TRD Sport", "TRD Off-Road", "Limited"],
        ["Tow Package", "Bedliner", "Crawl Control"]),
    ("Toyota", "RAV4",       "SUV",   "AWD", "Hybrid",   33000,
        ["LE", "XLE", "Adventure", "Limited"],
        ["Hybrid Powertrain", "Apple CarPlay", "Heated Seats"]),
    ("Toyota", "Corolla",    "Sedan", "FWD", "Gasoline", 23000,
        ["L", "LE", "SE", "XSE"],
        ["Apple CarPlay", "Lane Keep Assist", "Adaptive Cruise"]),
    ("Toyota", "4Runner",    "SUV",   "4WD", "Gasoline", 45000,
        ["SR5", "TRD Off-Road", "Limited"],
        ["Skid Plates", "Crawl Control", "Tow Package"]),
    ("Toyota", "Tundra",     "Truck", "4WD", "Gasoline", 47000,
        ["SR5", "Limited", "Platinum", "1794"],
        ["Tow Package", "Bedliner", "Sunroof"]),

    # ── Honda ──────────────────────────────────────────────────────
    ("Honda", "Civic",   "Sedan",     "FWD", "Gasoline", 25000,
        ["LX", "Sport", "EX", "Touring"],
        ["Apple CarPlay", "Honda Sensing", "Heated Seats"]),
    ("Honda", "CR-V",    "SUV",       "AWD", "Gasoline", 32000,
        ["LX", "EX", "EX-L", "Touring"],
        ["Honda Sensing", "Apple CarPlay", "Power Tailgate"]),
    ("Honda", "Pilot",   "SUV",       "AWD", "Gasoline", 41000,
        ["Sport", "EX-L", "Touring", "Elite"],
        ["Third Row Seating", "Honda Sensing", "Sunroof"]),
    ("Honda", "Accord",  "Sedan",     "FWD", "Gasoline", 29000,
        ["LX", "Sport", "EX-L", "Touring"],
        ["Apple CarPlay", "Honda Sensing", "Heated Seats"]),
    ("Honda", "Odyssey", "Minivan",   "FWD", "Gasoline", 38000,
        ["EX", "EX-L", "Touring", "Elite"],
        ["Power Sliding Doors", "Rear Entertainment", "Cabin Watch"]),

    # ── Ford ───────────────────────────────────────────────────────
    ("Ford", "F-150",    "Truck",     "4WD", "Gasoline", 48000,
        ["XL", "XLT", "Lariat", "King Ranch"],
        ["Tow Package", "Bedliner", "Sync 4"]),
    ("Ford", "Explorer", "SUV",       "AWD", "Gasoline", 39000,
        ["XLT", "Limited", "ST", "Platinum"],
        ["Third Row Seating", "Sync 4", "Sunroof"]),
    ("Ford", "Mustang",  "Coupe",     "RWD", "Gasoline", 35000,
        ["EcoBoost", "GT", "Mach 1"],
        ["Performance Package", "Premium Audio", "Recaro Seats"]),
    ("Ford", "Escape",   "SUV",       "AWD", "Hybrid",   30000,
        ["S", "SE", "SEL", "Titanium"],
        ["Hybrid Powertrain", "Sync 3", "Heated Seats"]),

    # ── Chevrolet ──────────────────────────────────────────────────
    ("Chevrolet", "Silverado", "Truck", "4WD", "Gasoline", 44000,
        ["WT", "Custom", "LT", "RST"],
        ["Tow Package", "Bedliner", "MyLink"]),
    ("Chevrolet", "Equinox",   "SUV",   "AWD", "Gasoline", 28000,
        ["LS", "LT", "Premier"],
        ["MyLink", "Heated Seats", "Power Liftgate"]),
    ("Chevrolet", "Tahoe",     "SUV",   "4WD", "Gasoline", 56000,
        ["LS", "LT", "RST", "Z71"],
        ["Third Row Seating", "Sunroof", "Tow Package"]),
    ("Chevrolet", "Traverse",  "SUV",   "AWD", "Gasoline", 36000,
        ["LS", "LT", "RS", "Premier"],
        ["Third Row Seating", "MyLink", "Power Liftgate"]),

    # ── Tesla ──────────────────────────────────────────────────────
    ("Tesla", "Model Y", "SUV",   "AWD", "Electric", 50000,
        ["Long Range", "Performance"],
        ["Autopilot", "Glass Roof", "Premium Audio"]),
    ("Tesla", "Model 3", "Sedan", "RWD", "Electric", 42000,
        ["Standard Range", "Long Range", "Performance"],
        ["Autopilot", "Glass Roof", "Premium Audio"]),

    # ── Subaru ─────────────────────────────────────────────────────
    ("Subaru", "Outback",   "Wagon", "AWD", "Gasoline", 31000,
        ["Base", "Premium", "Limited", "Touring XT"],
        ["EyeSight", "Roof Rails", "All-Weather Package"]),
    ("Subaru", "Forester",  "SUV",   "AWD", "Gasoline", 29000,
        ["Base", "Premium", "Sport", "Limited"],
        ["EyeSight", "Apple CarPlay", "Heated Seats"]),
    ("Subaru", "Crosstrek", "SUV",   "AWD", "Gasoline", 26000,
        ["Base", "Premium", "Sport", "Limited"],
        ["EyeSight", "Roof Rails", "Heated Seats"]),

    # ── Mazda ──────────────────────────────────────────────────────
    ("Mazda", "CX-5",   "SUV",   "AWD", "Gasoline", 30000,
        ["S", "Preferred", "Carbon Edition", "Premium Plus"],
        ["Bose Audio", "Heated Seats", "Power Liftgate"]),
    ("Mazda", "Mazda3", "Sedan", "FWD", "Gasoline", 24000,
        ["S", "Select", "Preferred", "Premium"],
        ["Apple CarPlay", "Heated Seats", "Bose Audio"]),

    # ── Hyundai / Kia ──────────────────────────────────────────────
    ("Hyundai", "Tucson",     "SUV", "AWD", "Hybrid",   33000,
        ["SE", "SEL", "Limited"],
        ["Hybrid Powertrain", "Apple CarPlay", "Smart Cruise"]),
    ("Hyundai", "Santa Fe",   "SUV", "AWD", "Gasoline", 35000,
        ["SE", "SEL", "Limited", "Calligraphy"],
        ["Apple CarPlay", "Smart Cruise", "Heated Seats"]),
    ("Kia",     "Telluride",  "SUV", "AWD", "Gasoline", 42000,
        ["LX", "S", "EX", "SX"],
        ["Third Row Seating", "Apple CarPlay", "Sunroof"]),
    ("Kia",     "Sorento",    "SUV", "AWD", "Hybrid",   36000,
        ["LX", "S", "EX", "SX"],
        ["Hybrid Powertrain", "Apple CarPlay", "Heated Seats"]),

    # ── Jeep ───────────────────────────────────────────────────────
    ("Jeep", "Wrangler",       "SUV", "4WD", "Gasoline", 40000,
        ["Sport", "Sahara", "Rubicon"],
        ["Removable Top", "Tow Package", "Skid Plates"]),
    ("Jeep", "Grand Cherokee", "SUV", "4WD", "Gasoline", 44000,
        ["Laredo", "Limited", "Overland", "Summit"],
        ["Quadra-Lift Suspension", "Sunroof", "Tow Package"]),

    # ── BMW (premium) ──────────────────────────────────────────────
    ("BMW", "X3",   "SUV",   "AWD", "Gasoline", 52000,
        ["sDrive30i", "xDrive30i", "M40i"],
        ["Premium Package", "Sunroof", "Harman Kardon Audio"]),
    ("BMW", "330i", "Sedan", "RWD", "Gasoline", 48000,
        ["330i", "330e", "M340i"],
        ["Premium Package", "Sunroof", "Sport Package"]),
]

DEALERS = [
    ("acme-toyota-charlotte",     "Acme Toyota Charlotte",      "Charlotte",   "NC", "28202"),
    ("raleigh-auto-direct",       "Raleigh Auto Direct",        "Raleigh",     "NC", "27604"),
    ("wilmington-used-cars",      "Wilmington Used Cars",       "Wilmington",  "NC", "28403"),
    ("atlanta-premier-motors",    "Atlanta Premier Motors",     "Atlanta",     "GA", "30303"),
    ("tampa-bay-autoplex",        "Tampa Bay Autoplex",         "Tampa",       "FL", "33601"),
    ("charleston-coastal-cars",   "Charleston Coastal Cars",    "Charleston",  "SC", "29401"),
    ("richmond-auto-hub",         "Richmond Auto Hub",          "Richmond",    "VA", "23219"),
    ("nashville-motors",          "Nashville Motors",           "Nashville",   "TN", "37203"),
]

COLORS_EXTERIOR = [
    "Magnetic Gray Metallic", "Midnight Black Metallic", "Pearl White",
    "Blueprint Blue", "Ruby Flare Pearl", "Cement", "Silver Sky Metallic",
    "Army Green", "Wind Chill Pearl", "Lunar Rock", "Supersonic Red",
]
COLORS_INTERIOR = ["Black", "Black/Gray", "Beige", "Cocoa", "Saddle Tan", "Stone"]

TITLE_STATUS_WEIGHTS = [("Clean", 90), ("Rebuilt", 4), ("Salvage", 2), ("Lemon", 1)]

# 80% dealer_feed, 10% auction, 5% owned, 5% consignment
SOURCE_TYPE_WEIGHTS = [
    ("dealer_feed",  80),
    ("auction",      10),
    ("owned",         5),
    ("consignment",   5),
]


# ────────────────────────────────────────────────────────────────────
#  Generators
# ────────────────────────────────────────────────────────────────────

_VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"   # excludes I, O, Q


def generate_vin(rng: random.Random) -> str:
    return "".join(rng.choice(_VIN_CHARS) for _ in range(17))


def weighted_choice(rng: random.Random, weighted_items):
    items, weights = zip(*weighted_items)
    return rng.choices(items, weights=weights, k=1)[0]


def depreciate(new_msrp: float, age_years: int, mileage: int, rng: random.Random) -> float:
    """Rough depreciation model — calibrated for plausible used-car prices.

    Year 1: -15%
    Year 2: -22%
    Year 3: -28%
    Year 4: -34%
    Year 5: -40%
    Year 6+: gradually trends toward -55%
    Plus a small mileage penalty for excess miles above ~12k/yr.
    """
    yearly_curve = [0, 0.15, 0.22, 0.28, 0.34, 0.40, 0.46, 0.51, 0.55]
    base_dep = yearly_curve[min(age_years, len(yearly_curve) - 1)]

    expected_mi = 12000 * age_years
    excess_mi   = max(0, mileage - expected_mi)
    mileage_pen = (excess_mi / 50000) * 0.05        # +5% off per 50k excess

    total_dep = min(0.65, base_dep + mileage_pen)
    noise = rng.uniform(-0.03, 0.03)                # ±3% sticker noise
    price = new_msrp * (1 - total_dep) * (1 + noise)
    return round(price, -2)                         # round to nearest $100


def carfax_summary_for(title_status: str, accident_count: int, owner_count: int) -> str:
    if title_status != "Clean":
        return f"{title_status} title — see disclosure. {accident_count} accident(s) on record."
    if accident_count == 0:
        return f"Clean title. No accidents reported. {owner_count} previous owner(s)."
    return (
        f"Clean title. {accident_count} accident(s) reported "
        f"(non-structural). {owner_count} previous owner(s)."
    )


# ── Local photo bank (bundled in workflow/static/photos/) ───────────────────
#
# Curated set of free-license Unsplash photos downloaded once at setup time.
# Vehicles are mapped to a photo by body_style, choosing deterministically
# from the available variants using a VIN-derived seed.
#
# To add more photos: drop new <body-style>-N.jpg files into
# workflow/static/photos/ and add the filename below.
PHOTO_BANK = {
    "SUV":         ["suv-1.jpg", "suv-2.jpg", "suv-3.jpg"],
    "Sedan":       ["sedan-1.jpg", "sedan-2.jpg", "sedan-3.jpg"],
    "Truck":       ["truck-2.jpg"],
    "Coupe":       ["coupe-1.jpg", "coupe-2.jpg"],
    "Hatchback":   ["hatchback-1.jpg"],
    "Wagon":       ["wagon-1.jpg"],
    "Minivan":     ["minivan-1.jpg"],
    "Convertible": ["convertible-1.jpg"],
    "Van":         ["van-1.jpg"],
}
_FALLBACK_PHOTOS = ["generic-1.jpg", "generic-2.jpg"]


def vehicle_photo_urls(
    year: int,
    make: str,
    model: str,
    trim: Optional[str],
    color: Optional[str],
    body_style: Optional[str],
    vin: str,
    n: int = 3,
) -> List[str]:
    """
    Map a vehicle to local photo URLs from the bundled photo bank.

    Strategy:
      - Look up candidates for the vehicle's body_style.
      - Deterministically pick a primary photo using hash(vin).
      - Optionally cycle through other photos in the same body-style pool
        for vehicles that want multiple photos (interior, side, etc.).
    """
    # Prefer body-style-specific photos; only fall back to generic if the
    # body has zero photos in the bank.
    body_pool = PHOTO_BANK.get(body_style or "", [])
    candidates = body_pool if body_pool else _FALLBACK_PHOTOS

    start = abs(hash(vin)) % len(candidates)
    urls = []
    for i in range(n):
        filename = candidates[(start + i) % len(candidates)]
        urls.append(f"/static/photos/{filename}")
    return urls


def generate_vehicle(rng: random.Random, idx: int, template=None) -> dict:
    if template is None:
        template = rng.choice(TEMPLATES)
    make, model, body, drivetrain, fuel, msrp, trims, base_features = template
    year = rng.choices(
        [2018, 2019, 2020, 2021, 2022, 2023, 2024],
        weights=[1, 2, 3, 5, 8, 10, 8],
        k=1,
    )[0]
    age = CURRENT_YEAR - year

    # Mileage: ~12k/yr average ± noise
    avg_mi = max(2000, age * rng.randint(8000, 16000))
    mileage = max(2000, int(rng.gauss(avg_mi, 6000)))
    mileage = min(mileage, 180_000)

    price = depreciate(msrp, age, mileage, rng)

    title_status   = weighted_choice(rng, TITLE_STATUS_WEIGHTS)
    accident_count = (
        0 if title_status == "Clean" and rng.random() > 0.18
        else rng.randint(1, 3)
    )
    owner_count    = rng.choices([1, 2, 3, 4], weights=[60, 25, 10, 5], k=1)[0]

    source_type    = weighted_choice(rng, SOURCE_TYPE_WEIGHTS)
    if source_type in ("owned", "consignment"):
        # AutoCommand-held — always at NC lot
        source_id, source_name, city, state, zipc = (
            "autocommand-newbern", "AutoCommand New Bern Lot", "New Bern", "NC", "28560"
        )
        is_on_lot = True
    else:
        source_id, source_name, city, state, zipc = rng.choice(DEALERS)
        is_on_lot = False

    trim     = rng.choice(trims)
    features = list(base_features) + rng.sample(
        ["Backup Camera", "Bluetooth", "Cruise Control", "Heated Steering",
         "Leather Seats", "Navigation", "Premium Audio", "Remote Start",
         "Push-Button Start", "Wireless Charging"],
        k=rng.randint(2, 5),
    )

    exterior_color = rng.choice(COLORS_EXTERIOR)
    vin = generate_vin(rng)
    photos = vehicle_photo_urls(year, make, model, trim, exterior_color, body, vin, n=3)

    listed_offset_days = rng.randint(0, 90)
    listed_date = (datetime.utcnow() - timedelta(days=listed_offset_days)).isoformat()

    return {
        "vehicle_id":      f"AC-{year}-{idx:04d}",
        "vin":             vin,
        "source_type":     source_type,
        "source_id":       source_id,
        "source_name":     source_name,

        "year":            year,
        "make":            make,
        "model":           model,
        "trim":            trim,
        "body_style":      body,
        "mileage":         mileage,
        "exterior_color":  exterior_color,
        "interior_color":  rng.choice(COLORS_INTERIOR),
        "transmission":    "Automatic",
        "drivetrain":      drivetrain,
        "engine":          None,
        "fuel_type":       fuel,
        "mpg_city":        None,
        "mpg_highway":     None,

        "asking_price":    price,
        "estimated_otd_price":   round(price * 1.085, 2),  # rough fees+tax
        "market_value_estimate": None,                     # filled by scoring later
        "price_vs_market_pct":   None,

        "title_status":    title_status,
        "accident_count":  accident_count,
        "owner_count":     owner_count,
        "carfax_summary":  carfax_summary_for(title_status, accident_count, owner_count),
        "recall_count":    rng.choices([0, 0, 0, 1, 2], k=1)[0],
        "condition_score": round(rng.uniform(6.5, 9.5), 1) if source_type in ("owned", "consignment") else None,

        "photos":          photos,
        "walkaround_video": None,
        "features":        features,
        "description":     f"{year} {make} {model} {trim} — {mileage:,} miles. {carfax_summary_for(title_status, accident_count, owner_count)}",

        "location_city":         city,
        "location_state":        state,
        "location_zip":          zipc,
        "is_on_autocommand_lot": is_on_lot,

        "score":           None,

        "status":          "active",
        "listed_date":     listed_date,
        "last_updated":    listed_date,
        "last_seen_in_feed": listed_date,
    }


# ────────────────────────────────────────────────────────────────────
#  CLI actions
# ────────────────────────────────────────────────────────────────────


def cmd_generate(count: int, seed: int) -> None:
    rng = random.Random(seed)
    vehicles = []
    # First pass: guarantee at least 1 of each template (so every model is searchable)
    for idx, template in enumerate(TEMPLATES, start=1):
        if len(vehicles) >= count:
            break
        vehicles.append(generate_vehicle(rng, idx, template=template))
    # Random fill for the remaining slots
    for idx in range(len(vehicles) + 1, count + 1):
        vehicles.append(generate_vehicle(rng, idx))
    # Stable order by vehicle_id for reproducibility
    vehicles.sort(key=lambda v: v["vehicle_id"])
    DEALER_FEED_PATH.write_text(json.dumps(vehicles, indent=2))
    log_info("seed.generate.done", path=str(DEALER_FEED_PATH), count=count,
             templates_covered=len(TEMPLATES))


def cmd_load() -> None:
    if not DEALER_FEED_PATH.exists():
        log_warning("seed.load.missing_fixture", path=str(DEALER_FEED_PATH))
        cmd_generate(count=100, seed=42)

    data = json.loads(DEALER_FEED_PATH.read_text())
    init_db()
    inserted, skipped = 0, 0
    with session_scope() as session:
        for raw in data:
            existing = session.exec(
                select(Vehicle).where(Vehicle.vehicle_id == raw["vehicle_id"])
            ).first()
            if existing:
                skipped += 1
                continue
            # model_validate runs Pydantic coercion (ISO strings → datetime, etc.)
            session.add(Vehicle.model_validate(raw))
            inserted += 1
    log_info("seed.load.done", inserted=inserted, skipped=skipped)


def cmd_reset() -> None:
    init_db()
    with session_scope() as session:
        deleted = session.query(Vehicle).delete()
    log_info("seed.reset.deleted", count=deleted)
    cmd_generate(count=100, seed=42)
    cmd_load()


def main(argv=None) -> int:
    configure_logging()
    parser = argparse.ArgumentParser(description="AutoCommand fixture seeder")
    parser.add_argument(
        "action",
        nargs="?",
        default="load",
        choices=["generate", "load", "reset"],
        help="generate=rewrite JSON; load=read JSON → DB; reset=wipe + regen + reload",
    )
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--seed",  type=int, default=42)
    args = parser.parse_args(argv)

    if args.action == "generate":
        cmd_generate(count=args.count, seed=args.seed)
    elif args.action == "load":
        cmd_load()
    elif args.action == "reset":
        cmd_reset()
    return 0


if __name__ == "__main__":
    sys.exit(main())
