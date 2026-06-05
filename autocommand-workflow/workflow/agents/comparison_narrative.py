"""
comparison_narrative agent — call site #5.

Takes 2-5 vehicles (with their VehicleScore) and an optional CustomerProfile.
Returns a recommendation + narrative + per-vehicle pros/cons.

This is the ONE place in the compare flow where an LLM is invoked. The
side-by-side table itself is built deterministically by
`workflow.operations.compare.compare_vehicles`.
"""

import json
import re
from pathlib import Path
from typing import List, Optional

from openai import AsyncOpenAI

from workflow.config import OPENAI_MODEL_NAME
from workflow.logging_utils import log_error, log_info
from workflow.schemas import CustomerProfile


_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "comparison_narrative.txt"


# ── Prompt cache ────────────────────────────────────────────────────────────


_PROMPT: Optional[str] = None


def _load_prompt() -> str:
    global _PROMPT
    if _PROMPT is None:
        _PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")
    return _PROMPT


# ── LLM client (built lazily, raises if no key) ─────────────────────────────


_CLIENT: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    """Lazy-init an OpenAI-compatible client. Honors OPENAI_API_KEY + OPENAI_BASE_URL."""
    global _CLIENT
    if _CLIENT is None:
        import os
        api_key  = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set — AI comparison is disabled. "
                "Set the env var (or point OPENAI_BASE_URL at a self-hosted endpoint)."
            )
        _CLIENT = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _CLIENT


# ── Public API ──────────────────────────────────────────────────────────────


async def comparison_narrative(
    vehicles: List[dict],
    customer: Optional[CustomerProfile] = None,
) -> dict:
    """
    Produce a personalized comparison narrative.

    Args:
        vehicles: list of 2-5 dicts, each containing vehicle data + score
        customer: optional CustomerProfile for personalization

    Returns:
        {recommendation, narrative, trade_offs} matching the prompt schema.
    """
    if not (2 <= len(vehicles) <= 5):
        raise ValueError(f"comparison_narrative requires 2-5 vehicles, got {len(vehicles)}")

    client       = _get_client()
    system_msg   = _load_prompt()
    user_payload = {
        "customer": customer.model_dump() if customer else {},
        "vehicles": vehicles,
    }

    log_info(
        "agent.comparison_narrative.start",
        vehicle_count=len(vehicles),
        has_customer=bool(customer),
    )

    response = await client.chat.completions.create(
        model=OPENAI_MODEL_NAME,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user",   "content": json.dumps(user_payload)},
        ],
        response_format={"type": "json_object"},
        temperature=1,
    )
    raw = response.choices[0].message.content or ""
    log_info("agent.comparison_narrative.tokens",
             prompt=response.usage.prompt_tokens if response.usage else None,
             completion=response.usage.completion_tokens if response.usage else None)

    try:
        return _parse(raw)
    except Exception as exc:
        log_error("agent.comparison_narrative.parse_error", raw=raw[:500], exc=exc)
        raise


# ── Output parsing (be liberal about code fences) ──────────────────────────


def _parse(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return json.loads(text.strip())
