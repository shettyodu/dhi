"""
Inventory search — turn a CustomerProfile into a SQL query.

This is the "Inventory Search Agent" mentioned in the spec, but implemented as
plain SQL. No LLM involved. Sub-100ms for the POC's 100-row dataset; will stay
fast into the tens of thousands of rows with the existing indexes.
"""

from typing import List

from sqlmodel import select

from workflow.db import session_scope
from workflow.schemas import CustomerProfile, Vehicle


def inventory_search(profile: CustomerProfile, limit: int = 50) -> List[Vehicle]:
    """
    Return up to `limit` active vehicles that match the customer's filters.

    Filters that are null in the profile are skipped (the customer didn't
    specify them, so we don't constrain on them).
    """
    with session_scope() as session:
        q = select(Vehicle).where(Vehicle.status == "active")

        if profile.make:
            q = q.where(Vehicle.make == profile.make)
        if profile.model:
            q = q.where(Vehicle.model == profile.model)

        if profile.body_style:
            q = q.where(Vehicle.body_style == profile.body_style)
        if profile.fuel_type:
            q = q.where(Vehicle.fuel_type == profile.fuel_type)
        if profile.drivetrain:
            q = q.where(Vehicle.drivetrain == profile.drivetrain)
        if profile.transmission:
            q = q.where(Vehicle.transmission == profile.transmission)

        if profile.year_min is not None:
            q = q.where(Vehicle.year >= profile.year_min)
        if profile.year_max is not None:
            q = q.where(Vehicle.year <= profile.year_max)

        if profile.mileage_max is not None:
            q = q.where(Vehicle.mileage <= profile.mileage_max)

        if profile.budget_min is not None:
            q = q.where(Vehicle.asking_price >= profile.budget_min)
        if profile.budget_max is not None:
            q = q.where(Vehicle.asking_price <= profile.budget_max)

        # Location filter is intentionally NOT hard — out-of-state matches
        # still appear (with shipping cost factored into scoring). We only
        # use location for ranking/bucketing.

        # Initial ordering: cheaper first. Scoring step will reorder.
        q = q.order_by(Vehicle.asking_price.asc()).limit(limit)

        return list(session.exec(q).all())
