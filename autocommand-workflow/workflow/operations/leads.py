"""
Persist customer leads and search history to the DB.

The Lead row is the canonical "captured customer" — every search creates one.
SearchHistory rows are append-only event records for analytics and future ML.
"""

import secrets
from datetime import datetime
from typing import Optional

from workflow.db import session_scope
from workflow.schemas import CustomerProfile, Lead, SearchHistory


def _new_id(prefix: str) -> str:
    """Timestamped + random-suffix ID, sortable lexicographically."""
    return datetime.utcnow().strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(3) + f"-{prefix}"


def store_lead(
    profile: CustomerProfile,
    source_query: Optional[str] = None,
) -> str:
    """Persist a CustomerProfile as a Lead row. Returns the new lead_id."""
    lead_id = _new_id("L")
    with session_scope() as session:
        session.add(Lead(
            lead_id=lead_id,
            profile_json=profile.model_dump_json(),
            source_query=source_query,
        ))
    return lead_id


def store_search_history(
    profile: CustomerProfile,
    *,
    lead_id: Optional[str] = None,
    nl_input: Optional[str] = None,
    result_count: int = 0,
    duration_ms: int = 0,
) -> str:
    """Append a SearchHistory row for analytics. Returns the search_id."""
    search_id = _new_id("S")
    with session_scope() as session:
        session.add(SearchHistory(
            search_id=search_id,
            lead_id=lead_id,
            profile_json=profile.model_dump_json(),
            nl_input=nl_input,
            result_count=result_count,
            duration_ms=duration_ms,
        ))
    return search_id
