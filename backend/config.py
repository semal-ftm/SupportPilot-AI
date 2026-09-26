import os
import secrets

from dotenv import load_dotenv


load_dotenv()


def _bool(name, default):
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in ("1", "true", "yes", "on")


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./supportpilot.db")

# Where staff open the dashboard; used for links in alert emails
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "http://localhost:5173")

# Used to sign login tokens. If it is not set, a random secret is generated
# on every start, which logs everyone out after a restart.
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "12"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# Also allow any localhost port, so the dev server still works when Vite
# moves to 5174+ because 5173 is busy. Set to an empty value in production.
CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
) or None

# Privacy
PII_MASKING = _bool("PII_MASKING", True)
REDACT_DOCUMENTS = _bool("REDACT_DOCUMENTS", True)
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "30"))

# Demo staff accounts, created on first start only
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@supportpilot.dev")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
AGENT_EMAIL = os.getenv("AGENT_EMAIL", "agent@supportpilot.dev")
AGENT_PASSWORD = os.getenv("AGENT_PASSWORD", "agent123")

# Where the document search index is kept
DATA_DIR = os.getenv("DATA_DIR", ".")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
