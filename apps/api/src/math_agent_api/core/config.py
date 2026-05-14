from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[3]


def _read_dotenv() -> dict[str, str]:
    env_path = API_ROOT / ".env"
    if not env_path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _get_env(name: str, default: str = "") -> str:
    dotenv_values = _read_dotenv()
    return os.environ.get(name, dotenv_values.get(name, default))


def _get_bool(name: str, default: bool) -> bool:
    value = _get_env(name, str(default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _get_float(name: str, default: float) -> float:
    value = _get_env(name, str(default)).strip()
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    database_url: str
    llm_provider: str
    llm_base_url: str
    llm_model: str
    llm_api_key: str
    llm_mock_fallback: bool
    llm_timeout_seconds: float
    ocr_provider: str
    ocr_mock_fallback: bool
    ocr_timeout_seconds: float
    doubao_base_url: str
    doubao_api_key: str
    doubao_vision_model: str
    mathpix_api_url: str
    mathpix_app_id: str
    mathpix_app_key: str

    @property
    def has_llm_credentials(self) -> bool:
        return bool(self.llm_base_url and self.llm_model and self.llm_api_key)

    @property
    def has_doubao_ocr_credentials(self) -> bool:
        return bool(self.doubao_base_url and self.doubao_api_key and self.doubao_vision_model)

    @property
    def has_mathpix_credentials(self) -> bool:
        return bool(self.mathpix_api_url and self.mathpix_app_id and self.mathpix_app_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        database_url=_get_env("DATABASE_URL", f"sqlite:///{API_ROOT / 'math_agent.db'}"),
        llm_provider=_get_env("LLM_PROVIDER", "mock"),
        llm_base_url=_get_env("LLM_BASE_URL", ""),
        llm_model=_get_env("LLM_MODEL", ""),
        llm_api_key=_get_env("LLM_API_KEY", ""),
        llm_mock_fallback=_get_bool("LLM_MOCK_FALLBACK", True),
        llm_timeout_seconds=_get_float("LLM_TIMEOUT_SECONDS", 60),
        ocr_provider=_get_env("OCR_PROVIDER", "mock"),
        ocr_mock_fallback=_get_bool("OCR_MOCK_FALLBACK", True),
        ocr_timeout_seconds=_get_float("OCR_TIMEOUT_SECONDS", 60),
        doubao_base_url=_get_env("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
        doubao_api_key=_get_env("DOUBAO_API_KEY", ""),
        doubao_vision_model=_get_env("DOUBAO_VISION_MODEL", ""),
        mathpix_api_url=_get_env("MATHPIX_API_URL", "https://api.mathpix.com/v3/text"),
        mathpix_app_id=_get_env("MATHPIX_APP_ID", ""),
        mathpix_app_key=_get_env("MATHPIX_APP_KEY", ""),
    )
