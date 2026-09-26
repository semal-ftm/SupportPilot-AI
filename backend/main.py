import asyncio
import logging
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_service import ai_available
from config import CORS_ORIGIN_REGEX, CORS_ORIGINS, PII_MASKING, RETENTION_DAYS
from database import migrate_schema
from rag import add_document, list_documents
from routers import (
    analytics,
    auth_routes,
    chat,
    knowledge,
    orders,
    privacy_routes,
    sessions,
    settings_routes,
    tickets,
)
from seed import seed_all


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("supportpilot")

RETENTION_CHECK_SECONDS = 6 * 3600

BUNDLED_POLICIES = ["refund_policy.txt", "shipping_policy.txt"]


def index_bundled_policies():
    """Make sure the sample policies are searchable on a fresh install."""

    indexed = {document["filename"] for document in list_documents()}

    for filename in BUNDLED_POLICIES:
        if filename not in indexed and os.path.exists(filename):
            add_document(filename, filename)
            logger.info("Indexed bundled policy %s", filename)


async def retention_loop():
    while True:
        try:
            removed = await asyncio.to_thread(privacy_routes.run_retention_policy)

            if removed:
                logger.info("Retention policy removed %s conversations", removed)

        except Exception:
            logger.exception("Retention policy failed")

        await asyncio.sleep(RETENTION_CHECK_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_schema()
    seed_all()
    index_bundled_policies()

    task = asyncio.create_task(retention_loop())

    yield

    task.cancel()


app = FastAPI(
    title="SupportPilot AI",
    description="Agentic AI Customer Support System",
    version="2.0.0",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"

    return response


for module in (
    auth_routes,
    chat,
    sessions,
    tickets,
    orders,
    knowledge,
    analytics,
    privacy_routes,
    settings_routes,
):
    app.include_router(module.router)


@app.get("/")
def home():
    return {
        "message": "SupportPilot AI Backend is running",
        "status": "success"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "ai_configured": ai_available(),
        "knowledge_documents": len(list_documents()),
        "pii_masking": PII_MASKING,
        "retention_days": RETENTION_DAYS,
    }
