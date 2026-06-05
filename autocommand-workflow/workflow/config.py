import os

# LLM model names (override via env vars; API keys come from OPENAI_API_KEY / ANTHROPIC_API_KEY)
OPENAI_MODEL_NAME    = os.getenv("OPENAI_MODEL_NAME",    "gpt-5.5")
ANTHROPIC_MODEL_NAME = os.getenv("ANTHROPIC_MODEL_NAME", "claude-opus-4-5-20251101")
