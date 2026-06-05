"""
nl_search_parser agent — LLM call site #2.

Converts a free-form natural-language vehicle search request into a typed
CustomerProfile that the downstream SQL pipeline can act on. This is the
"AI" piece behind the home page's free-text search box.

Single responsibility: text → CustomerProfile. No tool calls, no loops.
Returns None if the LLM is unavailable or the response fails to validate,
so the caller can degrade gracefully (e.g. show "please use the form").
"""

import json
import os
import re
from pathlib import Path
from typing import Optional

from openai import AsyncOpenAI

from workflow.config import OPENAI_MODEL_NAME
from workflow.logging_utils import log_error, log_info, log_warning
from workflow.schemas import CustomerProfile


_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "nl_search_parser.txt"


# ── Cached prompt + lazy client ─────────────────────────────────────────────


_PROMPT: Optional[str] = None
_CLIENT: Optional[AsyncOpenAI] = None


def _load_prompt() -> str:
    global _PROMPT
    if _PROMPT is None:
        _PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")
    return _PROMPT


def _get_client() -> AsyncOpenAI:
    """Lazy-init an OpenAI-compatible client (honors OPENAI_BASE_URL)."""
    global _CLIENT
    if _CLIENT is None:
        api_key  = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set — natural-language search is disabled. "
                "Set the env var (or point OPENAI_BASE_URL at a self-hosted endpoint)."
            )
        _CLIENT = AsyncOpenAI(api_key=api_key, base_url=base_url)
    return _CLIENT


# ── Public API ──────────────────────────────────────────────────────────────


async def nl_search_parser(query: str) -> Optional[CustomerProfile]:
    """
    Convert a free-form natural-language search into a CustomerProfile.

    Returns:
        CustomerProfile on success (may have all-null fields if input is too vague).
        None on LLM-availability or parse failure — caller should fall back.
    """
    if not query or not query.strip():
        return None

    log_info("agent.nl_search.start", chars=len(query), preview=query[:80])

    try:
        client      = _get_client()
        system_msg  = _load_prompt()
    except RuntimeError:
        # Re-raise so the caller can show "agent_unavailable" — distinct from a soft None
        raise

    try:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": query.strip()},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        log_error("agent.nl_search.llm_error", query=query, exc=exc)
        return None

    raw = response.choices[0].message.content or ""
    if response.usage:
        log_info(
            "agent.nl_search.tokens",
            prompt=response.usage.prompt_tokens,
            completion=response.usage.completion_tokens,
        )

    try:
        profile = _parse(raw)
    except Exception as exc:
        log_error("agent.nl_search.parse_error", raw=raw[:400], exc=exc)
        return None

    log_info(
        "agent.nl_search.done",
        make=profile.make,
        model=profile.model,
        body_style=profile.body_style,
        budget_max=profile.budget_max,
        state=profile.location_state,
        all_nulls=_all_nulls(profile),
    )
    return profile


# ── Internals ───────────────────────────────────────────────────────────────


def _parse(raw: str) -> CustomerProfile:
    """Strip code fences if any, then validate against CustomerProfile."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    data = json.loads(text.strip())
    return CustomerProfile.model_validate(data)


def _all_nulls(p: CustomerProfile) -> bool:
    """True if the agent could not extract any filter — caller can show the form."""
    d = p.model_dump()
    return not any(
        d[k] for k in d
        if k not in ("desired_features", "notes") and d[k] not in (None, [], "")
    )
