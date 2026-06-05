import os
from typing import Optional

from agents import AsyncOpenAI, OpenAIChatCompletionsModel

from workflow.logging_utils import log_info


_OPENAI_BASE_URL    = "https://api.openai.com/v1"
_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1/"


class OpenAIProvider:
    """Build an OpenAI chat model from the OPENAI_API_KEY environment variable."""

    def __init__(self, *, model_name: str) -> None:
        self.model_name = model_name
        self._client: Optional[AsyncOpenAI] = None
        self._model:  Optional[OpenAIChatCompletionsModel] = None

    def _build(self) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")

        log_info("openai.client.from_env", base_url=_OPENAI_BASE_URL, model=self.model_name)
        client = AsyncOpenAI(api_key=api_key, base_url=_OPENAI_BASE_URL)
        self._client = client
        self._model  = OpenAIChatCompletionsModel(model=self.model_name, openai_client=client)

    def get_model(self) -> OpenAIChatCompletionsModel:
        if self._model is None:
            self._build()
        return self._model  # type: ignore[return-value]


class AnthropicProvider:
    """Build an Anthropic chat model (via OpenAI-compatible endpoint) from ANTHROPIC_API_KEY."""

    def __init__(self, *, model_name: str) -> None:
        self.model_name = model_name
        self._client: Optional[AsyncOpenAI] = None
        self._model:  Optional[OpenAIChatCompletionsModel] = None

    def _build(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")

        log_info("anthropic.client.from_env", base_url=_ANTHROPIC_BASE_URL, model=self.model_name)
        client = AsyncOpenAI(api_key=api_key, base_url=_ANTHROPIC_BASE_URL)
        self._client = client
        self._model  = OpenAIChatCompletionsModel(model=self.model_name, openai_client=client)

    def get_model(self) -> OpenAIChatCompletionsModel:
        if self._model is None:
            self._build()
        return self._model  # type: ignore[return-value]
