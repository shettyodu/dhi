# http_server.py
import os
import httpx
import logging
from typing import Optional, Union, List
from typing_extensions import TypedDict
from contextvars import ContextVar
from starlette.requests import Request
from starlette.responses import PlainTextResponse

try:
    from fastmcp import FastMCP
except ImportError:
    from mcp.server.fastmcp import FastMCP

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse
import uvicorn

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger("idt-leasing-workflow-mcp-server")

# ---- Config ------------------------------------------------------------------
BASE_URL       = os.getenv("WF_BASE_URL", "http://dev.localhost:5004")
WF_TIMEOUT     = float(os.getenv("WF_TIMEOUT", "60.0"))
HOST           = os.getenv("HOST", "0.0.0.0")
PORT           = int(os.getenv("PORT", "8004"))

# Auth config:
# - If MCP_AUTH_TOKEN is set, require EXACT "Authorization: Bearer <MCP_AUTH_TOKEN>"
# - Else if MCP_REQUIRE_AUTH=true (default), require any Bearer token (and forward it upstream)
# - Else (false) no auth is enforced; WF_API_KEY (fallback) may be used for upstream
MCP_AUTH_TOKEN   = os.getenv("MCP_AUTH_TOKEN")
MCP_REQUIRE_AUTH = os.getenv("MCP_REQUIRE_AUTH", "true").lower() == "true"

# Optional static upstream key used only when no incoming token (and/or auth disabled)
WF_API_KEY_FALLBACK: Optional[str] = os.getenv("WF_API_KEY")

mcp = FastMCP("IDT leasing workflow Runner API")

# Per-request storage for incoming bearer token
INCOMING_BEARER_TOKEN: ContextVar[Optional[str]] = ContextVar("incoming_bearer_token", default=None)

# ---- Auth middleware ---------------------------------------------------------
class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        # ✅ Skip auth for /healthz (so probes can work unauthenticated)
        if request.url.path == "/healthz":
            return await call_next(request)

        auth_header = request.headers.get("authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):].strip()

        if MCP_AUTH_TOKEN:
            if token != MCP_AUTH_TOKEN:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
        elif MCP_REQUIRE_AUTH:
            if not token:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)

        reset = INCOMING_BEARER_TOKEN.set(token)
        try:
            response = await call_next(request)
        finally:
            INCOMING_BEARER_TOKEN.reset(reset)
        return response

# ---- Types & utils -----------------------------------------------------------
class RunWorkflowResult(TypedDict, total=False):
    status: int
    raw_text: str
    response_json: dict

def _normalize_args(args: Union[str, List[str]] = "") -> str:
    if isinstance(args, list):
        return ", ".join([str(a).strip() for a in args if str(a).strip()])
    parts = [p.strip() for p in str(args).split(",") if p.strip()]
    return ", ".join(parts)


# Define a custom route for the health check
@mcp.custom_route("/healthz", methods=["GET"])
async def health_check(request: Request) -> PlainTextResponse:
    """
    Returns a plain text "OK" response for health checks.
    """
    return PlainTextResponse("OK")


# ---- Tool --------------------------------------------------------------------
@mcp.tool()
def tax_research_workflow(
    city: str,
    state: str,
    args: Union[str, List[str]] = "",
    jurisdiction_names: Union[str, List[str]] = ""
) -> RunWorkflowResult:
    """
    Trigger the Lease Tax Research workflow via the upstream API.

    Parameters:
      - city (str, required):
          Target city for the run. Example: "birmingham", "denver", "beverly hills".
      - state (str, required):
          Target state/jurisdiction. Example: "alabama", "colorado", "california".
      - args (str | List[str], optional):
          Web source URLs for lease policy documents.
          • If a string, it may be a single URL or a comma-separated list.
          • If a list, each item should be a URL string.
      - jurisdiction_names (str | List[str], optional):
          TDR jurisdiction names for fetching tax rates.
          • If a string, it may be a single jurisdiction name or a comma-separated list.
          • If a list, each item should be a jurisdiction name string.
          • Example: ["CA - STATE SALES/USE TAX", "CA - LOS ANGELES (COUNTYWIDE), COUNTY SALES/USE TAX"]

    Behavior:
      - POSTs to WF_BASE_URL + /tax_research_workflow with JSON:
          { "user_id": "lambda", "city": <city>, "state": <state>, "args": [ ... ],
            "jurisdiction_names": [ ... ] }
        ("args" and "jurisdiction_names" are included only when non-empty.)
      - Forwards the inbound Bearer token if present; otherwise uses WF_API_KEY (fallback) if set.
      - Returns upstream status, raw text, and parsed JSON (if any).

    Returns:
      RunWorkflowResult:
        {
          "status": int,
          "raw_text": str,
          "response_json": dict
        }
    """
    uid = "lambda"

    ct = (city or "").strip()
    st = (state or "").strip()

    if not ct:
        return {"status": 400, "raw_text": "city is required", "response_json": {"error": "city is required"}}
    if not st:
        return {"status": 400, "raw_text": "state is required", "response_json": {"error": "state is required"}}

    # Normalize args → List[str] (or None)
    args_list: Optional[List[str]]
    if args is None or args == "":
        args_list = None
    elif isinstance(args, list):
        args_list = [str(a).strip() for a in args if str(a).strip()] or None
    else:
        parts = [p.strip() for p in str(args).split(",") if p.strip()]
        args_list = parts or None

    # Normalize jurisdiction_names → List[str] (or None)
    jurisdiction_names_list: Optional[List[str]]
    if jurisdiction_names is None or jurisdiction_names == "":
        jurisdiction_names_list = None
    elif isinstance(jurisdiction_names, list):
        jurisdiction_names_list = [str(j).strip() for j in jurisdiction_names if str(j).strip()] or None
    else:
        parts = [p.strip() for p in str(jurisdiction_names).split(",") if p.strip()]
        jurisdiction_names_list = parts or None

    url = BASE_URL.rstrip("/") + "/tax_research_workflow"
    headers = {"Content-Type": "application/json"}

    incoming = INCOMING_BEARER_TOKEN.get()
    api_token = incoming or WF_API_KEY_FALLBACK
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    payload = {"user_id": uid, "city": ct, "state": st}
    if args_list is not None:
        payload["args"] = args_list
    if jurisdiction_names_list is not None:
        payload["jurisdiction_names"] = jurisdiction_names_list

    log.info(
        f"POST {url} payload={{'user_id': '{uid}', 'city': '{ct}', 'state': '{st}', "
        f"'args': {args_list}, 'jurisdiction_names': {jurisdiction_names_list}}} "
        f"(auth={'incoming' if incoming else 'fallback' if api_token else 'none'})"
    )

    with httpx.Client(timeout=WF_TIMEOUT) as client:
        resp = client.post(url, headers=headers, json=payload)
        try:
            data = resp.json()
        except Exception:
            data = {}

        return {
            "status": resp.status_code,
            "raw_text": resp.text,
            "response_json": data,
        }


@mcp.tool()
def source_discovery_workflow(
    state: str,
    search_phrase: str,
) -> RunWorkflowResult:
    """
    Discover authoritative web sources for a given state and search topic.

    The workflow searches the web, evaluates sources, and produces a markdown
    report for the tax research team to review. The team can then select which
    sources to pass into the tax_research_workflow tool.

    Parameters:
      - state (str, required):
          Target state. Example: "california", "texas", "new york".
      - search_phrase (str, required):
          Topic to search for. Example: "leasing taxation", "equipment lease sales tax".

    Returns:
      RunWorkflowResult:
        {
          "status": int,
          "raw_text": str,
          "response_json": dict
        }
    """
    uid = "lambda"

    st = (state or "").strip()
    sp = (search_phrase or "").strip()

    if not st:
        return {"status": 400, "raw_text": "state is required", "response_json": {"error": "state is required"}}
    if not sp:
        return {"status": 400, "raw_text": "search_phrase is required", "response_json": {"error": "search_phrase is required"}}

    url = BASE_URL.rstrip("/") + "/source_discovery_workflow"
    headers = {"Content-Type": "application/json"}

    incoming = INCOMING_BEARER_TOKEN.get()
    api_token = incoming or WF_API_KEY_FALLBACK
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    payload = {"user_id": uid, "state": st, "search_phrase": sp}

    log.info(
        f"POST {url} payload={{'user_id': '{uid}', 'state': '{st}', 'search_phrase': '{sp}'}} "
        f"(auth={'incoming' if incoming else 'fallback' if api_token else 'none'})"
    )

    with httpx.Client(timeout=WF_TIMEOUT) as client:
        resp = client.post(url, headers=headers, json=payload)
        try:
            data = resp.json()
        except Exception:
            data = {}

        return {
            "status": resp.status_code,
            "raw_text": resp.text,
            "response_json": data,
        }


# ---- Serve (ASGI with middleware) -------------------------------------------
if __name__ == "__main__":
    app = mcp.http_app()   # Streamable HTTP endpoint at "/"
    app.add_middleware(AuthMiddleware)
    log.info(
        f"Starting MCP HTTP server on {HOST}:{PORT} "
        f"(auth={'exact' if MCP_AUTH_TOKEN else 'required' if MCP_REQUIRE_AUTH else 'off'})"
    )
    uvicorn.run(app, host=HOST, port=PORT)
