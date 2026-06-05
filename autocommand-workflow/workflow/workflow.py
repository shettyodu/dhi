"""
High-level workflow orchestration — placeholder.

For Phase 4 (REST API), there is no multi-step orchestrator. Each REST handler
calls the deterministic operations directly:

    profile → inventory_search → score_vehicle (per result) → bucket_vehicles

Later phases will add orchestrators here for stateful flows that span multiple
calls (e.g. the buy flow: deal_start → dealer_outreach → compliance_review →
shipping_book → ...).
"""
