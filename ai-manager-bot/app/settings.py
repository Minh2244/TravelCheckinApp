from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class AiManagerSettings:
    llm_provider: str
    openai_api_key: str
    openai_model: str
    openai_base_url: str
    gemini_api_keys: list[str]
    request_timeout_seconds: float

    @property
    def openai_enabled(self) -> bool:
        return self.llm_provider == "openai" and bool(self.openai_api_key)

    @property
    def gemini_enabled(self) -> bool:
        return self.llm_provider == "gemini" and bool(self.gemini_api_keys)


@lru_cache(maxsize=1)
def get_settings() -> AiManagerSettings:
    raw_keys = str(os.getenv("GEMINI_API_KEY", "")).strip()
    keys = [k.strip() for k in raw_keys.split(",")] if raw_keys else []
    
    return AiManagerSettings(
        llm_provider=str(os.getenv("AI_MANAGER_BOT_LLM_PROVIDER", "local")).strip().lower() or "local",
        openai_api_key=str(os.getenv("OPENAI_API_KEY", "")).strip(),
        openai_model=str(os.getenv("OPENAI_MODEL", "gpt-4.1-mini")).strip() or "gpt-4.1-mini",
        openai_base_url=(
            str(os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")).strip()
            or "https://api.openai.com/v1/chat/completions"
        ),
        gemini_api_keys=keys,
        request_timeout_seconds=float(os.getenv("AI_MANAGER_BOT_TIMEOUT_SECONDS", "20")),
    )
