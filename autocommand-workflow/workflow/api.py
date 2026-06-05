"""
AutoCommand AI Marketplace — REST API.

Routes (Phase 4):
  GET  /healthz                  liveness check (public)
  GET  /login                    login page (public)
  POST /login                    login submit (public)
  GET  /logout                   clear session
  GET  /                         home page (auth)

  POST /search                   structured search → bucketed results (auth)
  GET  /vehicle/<id>             single vehicle detail (auth)
  GET  /inventory/stats          aggregate counts (auth)
  POST /admin/reseed             wipe + regenerate fixtures (auth)

No LLM calls — all routes use deterministic operations only.
"""

import asyncio
import os
import secrets
import time
from pathlib import Path

from flask import (
    Flask, jsonify, redirect, render_template, request,
    session, url_for,
)
from flask_cors import CORS
from sqlmodel import func, select
from waitress import serve

from workflow.db import session_scope
from workflow.logging_utils import (
    configure_logging, log_error, log_info, log_warning,
)
from workflow.operations.bucketing import bucket_vehicles
from workflow.operations.compare import compare_vehicles
from workflow.operations.inventory_search import inventory_search
from workflow.operations.leads import store_lead, store_search_history
from workflow.operations.scoring import score_vehicle
from workflow.schemas import CustomerProfile, Vehicle


configure_logging()

_PKG_DIR      = Path(__file__).parent
TEMPLATES_DIR = _PKG_DIR / "templates"
STATIC_DIR    = _PKG_DIR / "static"

app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path="/static",
)
CORS(app)


# ── Auth ─────────────────────────────────────────────────────────────────────
app.secret_key = os.getenv("FLASK_SECRET_KEY") or secrets.token_urlsafe(32)
APP_USERNAME   = os.getenv("APP_USERNAME", "tester")
APP_PASSWORD   = os.getenv("APP_PASSWORD", "autocommand2026")

_PUBLIC_ENDPOINTS = {"login", "logout", "healthz", "static"}

# Paths that should return JSON 401 instead of redirecting (for API/MCP clients)
_API_PATH_PREFIXES = (
    "/search", "/search/nl", "/vehicle/", "/inventory/", "/admin/",
    "/compare/narrative",
)


@app.before_request
def _require_login():
    if request.endpoint in _PUBLIC_ENDPOINTS or request.endpoint is None:
        return
    if session.get("authed"):
        return
    if any(request.path.startswith(p) for p in _API_PATH_PREFIXES):
        return jsonify({"error": "Unauthorized"}), 401
    return redirect(url_for("login"))


# ── Auth routes ──────────────────────────────────────────────────────────────


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok"}), 200


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        u = (request.form.get("username") or "").strip()
        p = request.form.get("password") or ""
        if u == APP_USERNAME and p == APP_PASSWORD:
            session["authed"] = True
            session["user"]   = u
            log_info("api.login.success", user=u)
            return redirect(url_for("index"))
        log_warning("api.login.failed", user=u)
        error = "Invalid username or password"
    return render_template("login.html", error=error)


@app.route("/logout", methods=["GET", "POST"])
def logout():
    user = session.get("user")
    session.clear()
    log_info("api.logout", user=user)
    return redirect(url_for("login"))


# ── Home (frontend will land here in Phase 5) ────────────────────────────────


@app.get("/")
def index():
    return render_template("index.html", user=session.get("user"))


# ── Search ───────────────────────────────────────────────────────────────────


@app.post("/search")
def search():
    """
    Structured search endpoint.

    Body: a JSON object matching the CustomerProfile schema (all fields optional).
    Returns: {lead_id, profile, results} where results are bucketed.
    """
    try:
        body = request.get_json(silent=True) or {}
        profile = CustomerProfile.model_validate(body)
    except Exception as exc:
        log_warning("api.search.bad_request", exc=exc)
        return jsonify({"error": "Invalid profile", "details": str(exc)}), 400

    t0 = time.perf_counter()
    vehicles = inventory_search(profile, limit=50)
    scored   = [(v, score_vehicle(v, profile)) for v in vehicles]
    result   = bucket_vehicles(scored, profile)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    lead_id = store_lead(profile)
    store_search_history(
        profile, lead_id=lead_id,
        result_count=result["total_count"], duration_ms=elapsed_ms,
    )

    log_info(
        "api.search.done",
        lead_id=lead_id, results=result["total_count"], duration_ms=elapsed_ms,
    )
    return jsonify({
        "lead_id":     lead_id,
        "profile":     profile.model_dump(),
        "results":     result,
        "duration_ms": elapsed_ms,
    }), 200


# ── Natural-language search ──────────────────────────────────────────────────


@app.post("/search/nl")
def search_nl():
    """
    Free-text vehicle search.

    Body: {"query": "natural language description"}
    Flow:
        text → nl_search_parser (LLM)  → CustomerProfile
                                       ↓
              the SAME deterministic pipeline as /search
                                       ↓
                          {lead_id, profile, results}
    """
    body  = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Provide a 'query' field"}), 400

    # Lazy import so the home page renders even when no API key is set
    from workflow.agents.nl_search_parser import nl_search_parser

    try:
        t0 = time.perf_counter()
        profile = asyncio.run(nl_search_parser(query))
        nl_elapsed_ms = int((time.perf_counter() - t0) * 1000)
    except RuntimeError as exc:
        # OPENAI_API_KEY not set or similar config issue
        log_warning("api.search.nl.unavailable", exc=exc)
        return jsonify({"error": str(exc), "code": "agent_unavailable"}), 503
    except Exception as exc:
        log_error("api.search.nl.error", query=query, exc=exc)
        return jsonify({"error": "Could not parse query", "details": str(exc)}), 500

    if profile is None:
        # Soft fail — LLM returned something we couldn't validate
        log_warning("api.search.nl.no_profile", query=query)
        return jsonify({
            "error": "We couldn't understand that search — try the structured filters.",
            "code":  "parse_failed",
        }), 422

    # Run the deterministic pipeline against the LLM-derived profile
    t0 = time.perf_counter()
    vehicles = inventory_search(profile, limit=50)
    scored   = [(v, score_vehicle(v, profile)) for v in vehicles]
    result   = bucket_vehicles(scored, profile)
    search_elapsed_ms = int((time.perf_counter() - t0) * 1000)

    lead_id = store_lead(profile, source_query=query)
    store_search_history(
        profile,
        lead_id=lead_id,
        nl_input=query,
        result_count=result["total_count"],
        duration_ms=nl_elapsed_ms + search_elapsed_ms,
    )

    log_info(
        "api.search.nl.done",
        lead_id=lead_id,
        results=result["total_count"],
        nl_ms=nl_elapsed_ms,
        search_ms=search_elapsed_ms,
    )
    return jsonify({
        "lead_id":           lead_id,
        "profile":           profile.model_dump(),
        "results":           result,
        "nl_duration_ms":    nl_elapsed_ms,
        "search_duration_ms": search_elapsed_ms,
        "duration_ms":       nl_elapsed_ms + search_elapsed_ms,
    }), 200


# ── Single-vehicle detail ────────────────────────────────────────────────────


@app.get("/vehicle/<vehicle_id>")
def vehicle_detail(vehicle_id: str):
    with session_scope() as s:
        v = s.exec(select(Vehicle).where(Vehicle.vehicle_id == vehicle_id)).first()
    if v is None:
        return jsonify({"error": "Vehicle not found"}), 404

    # Score with no customer profile (generic baseline)
    s_score = score_vehicle(v).model_dump()

    return jsonify({
        **v.model_dump(),
        "score": s_score,
    }), 200


# ── Inventory aggregates (handy for MCP + admin) ─────────────────────────────


@app.get("/inventory/stats")
def inventory_stats():
    """Return aggregate counts useful for both the admin UI and MCP clients."""
    with session_scope() as s:
        total = s.exec(
            select(func.count(Vehicle.vehicle_id)).where(Vehicle.status == "active")
        ).one()

        by_make = s.exec(
            select(Vehicle.make, func.count(Vehicle.vehicle_id))
            .where(Vehicle.status == "active")
            .group_by(Vehicle.make)
            .order_by(func.count(Vehicle.vehicle_id).desc())
        ).all()

        by_body = s.exec(
            select(Vehicle.body_style, func.count(Vehicle.vehicle_id))
            .where(Vehicle.status == "active")
            .group_by(Vehicle.body_style)
            .order_by(func.count(Vehicle.vehicle_id).desc())
        ).all()

        by_state = s.exec(
            select(Vehicle.location_state, func.count(Vehicle.vehicle_id))
            .where(Vehicle.status == "active")
            .group_by(Vehicle.location_state)
            .order_by(func.count(Vehicle.vehicle_id).desc())
        ).all()

        by_source = s.exec(
            select(Vehicle.source_type, func.count(Vehicle.vehicle_id))
            .where(Vehicle.status == "active")
            .group_by(Vehicle.source_type)
        ).all()

        price_stats = s.exec(
            select(
                func.min(Vehicle.asking_price),
                func.max(Vehicle.asking_price),
                func.avg(Vehicle.asking_price),
            ).where(Vehicle.status == "active")
        ).one()

    return jsonify({
        "total_active":   total,
        "by_make":        [{"make": m, "count": n} for m, n in by_make],
        "by_body_style":  [{"body_style": b, "count": n} for b, n in by_body if b],
        "by_state":       [{"state": st, "count": n} for st, n in by_state if st],
        "by_source_type": [{"source_type": st, "count": n} for st, n in by_source],
        "price":          {
            "min": price_stats[0],
            "max": price_stats[1],
            "avg": round(price_stats[2], 2) if price_stats[2] else None,
        },
    }), 200


# ── Compare ──────────────────────────────────────────────────────────────────


def _parse_ids_param(raw: str) -> list[str]:
    return [s.strip() for s in (raw or "").split(",") if s.strip()]


@app.get("/compare")
def compare_page():
    """
    Render the side-by-side compare page for 2-5 vehicles.
    Query params:
      ids:   comma-separated vehicle IDs (required)
      ...:   any CustomerProfile field, used to score with context
    """
    ids = _parse_ids_param(request.args.get("ids", ""))
    if not ids:
        return render_template(
            "compare.html",
            user=session.get("user"),
            error="No vehicles selected for comparison.",
            data=None,
        )

    profile_fields = {k: v for k, v in request.args.items() if k != "ids"}
    profile = None
    if profile_fields:
        try:
            profile = CustomerProfile.model_validate(profile_fields)
        except Exception:
            profile = None

    try:
        data = compare_vehicles(ids, profile)
    except ValueError as exc:
        return render_template(
            "compare.html", user=session.get("user"), error=str(exc), data=None,
        )

    return render_template(
        "compare.html",
        user=session.get("user"),
        data=data,
        ids_csv=",".join(ids),
        profile_json=(profile.model_dump_json() if profile else "null"),
    )


@app.post("/compare/narrative")
def compare_narrative():
    """
    On-demand AI comparison narrative.

    Body: {"ids": [...], "profile": {...}|null}
    Returns: {recommendation, narrative, trade_offs}
    """
    body = request.get_json(silent=True) or {}
    ids  = body.get("ids") or []
    if not (2 <= len(ids) <= 5):
        return jsonify({"error": "Provide 2-5 vehicle ids"}), 400

    profile_dict = body.get("profile") or {}
    profile = None
    if profile_dict:
        try:
            profile = CustomerProfile.model_validate(profile_dict)
        except Exception as exc:
            log_warning("api.compare.bad_profile", exc=exc)
            profile = None

    # Build the deterministic data first; pass the vehicle dicts to the agent
    try:
        compare_data = compare_vehicles(ids, profile)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    # Lazy import so missing OPENAI_API_KEY doesn't break the rest of the app
    from workflow.agents.comparison_narrative import comparison_narrative

    try:
        t0 = time.perf_counter()
        result = asyncio.run(comparison_narrative(compare_data["vehicles"], profile))
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        log_info(
            "api.compare.narrative.done",
            vehicles=len(ids), duration_ms=elapsed_ms,
        )
        return jsonify({**result, "duration_ms": elapsed_ms}), 200
    except RuntimeError as exc:
        # OPENAI_API_KEY not set, or related config error
        log_warning("api.compare.narrative.unavailable", exc=exc)
        return jsonify({"error": str(exc), "code": "agent_unavailable"}), 503
    except Exception as exc:
        log_error("api.compare.narrative.error", exc=exc)
        return jsonify({"error": "Comparison narrative failed", "details": str(exc)}), 500


# ── Admin: reseed (dev convenience) ──────────────────────────────────────────


@app.post("/admin/reseed")
def admin_reseed():
    """Wipe inventory and reload from fixtures/dealer_feed.json."""
    try:
        from workflow.fixtures.seed import cmd_reset
        cmd_reset()
    except Exception as exc:
        log_error("api.admin.reseed.error", exc=exc)
        return jsonify({"error": str(exc)}), 500

    with session_scope() as s:
        count = s.exec(select(func.count(Vehicle.vehicle_id))).one()
    return jsonify({"status": "ok", "vehicle_count": count}), 200


# ── Entry point ──────────────────────────────────────────────────────────────


if __name__ == "__main__":
    from workflow.db import init_db
    init_db()
    port = int(os.getenv("PORT", 5005))
    log_info("api.start", port=port)
    serve(app, host="0.0.0.0", port=port)
