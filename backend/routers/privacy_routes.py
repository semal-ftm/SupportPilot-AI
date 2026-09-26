"""
Privacy & Trust Center: what the system does with personal data,
retention controls, and the audit trail of sensitive staff actions.
"""

import json
import uuid

from collections import Counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from config import GROQ_MODEL, PII_MASKING, REDACT_DOCUMENTS, RETENTION_DAYS
from database import SessionLocal, get_db
from models import AuditLog, ChatSession, Conversation, Feedback, User
from privacy import LABELS, forget_session, mask_text
from utils import audit, days_ago, iso


router = APIRouter(tags=["Privacy"])


def purge_older_than(db, days):
    """Delete conversations whose last activity is older than `days`."""

    cutoff = days_ago(days)

    stale = [
        row.id for row in
        db.query(ChatSession.id).filter(ChatSession.updated_at < cutoff)
    ]

    if not stale:
        return 0

    message_ids = [
        row.id for row in
        db.query(Conversation.id).filter(Conversation.session_id.in_(stale))
    ]

    db.query(Feedback).filter(Feedback.message_id.in_(message_ids)).delete(
        synchronize_session=False
    )
    db.query(Conversation).filter(Conversation.session_id.in_(stale)).delete(
        synchronize_session=False
    )
    db.query(ChatSession).filter(ChatSession.id.in_(stale)).delete(
        synchronize_session=False
    )

    for session_id in stale:
        forget_session(session_id)

    return len(stale)


def run_retention_policy():
    db = SessionLocal()

    try:
        removed = purge_older_than(db, RETENTION_DAYS)

        if removed:
            audit(
                db, "system", "retention_purge",
                detail=f"{removed} conversations older than {RETENTION_DAYS} days deleted"
            )

        db.commit()

        return removed

    finally:
        db.close()


@router.get("/privacy/overview", dependencies=[Depends(get_current_user)])
def privacy_overview(db: Session = Depends(get_db)):

    redactions = Counter()

    for (value,) in db.query(Conversation.redactions).filter(Conversation.redactions.isnot(None)):
        for item in json.loads(value):
            redactions[item["type"]] += 1

    oldest = db.query(func.min(Conversation.created_at)).scalar()

    return {
        "settings": {
            "pii_masking": PII_MASKING,
            "document_redaction": REDACT_DOCUMENTS,
            "retention_days": RETENTION_DAYS,
            "llm_provider": "Groq",
            "llm_model": GROQ_MODEL,
            "detected_types": [
                {"type": key, "label": label} for key, label in LABELS.items()
            ],
        },
        "stats": {
            "conversations": db.query(func.count(ChatSession.id)).scalar(),
            "messages": db.query(func.count(Conversation.id)).scalar(),
            "total_redactions": sum(redactions.values()),
            "redactions": [
                {"type": key, "label": LABELS.get(key, key), "count": count}
                for key, count in redactions.most_common()
            ],
            "oldest_message": iso(oldest),
        },
    }


@router.get("/privacy/audit")
def audit_log(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    rows = (
        db.query(AuditLog)
        .order_by(AuditLog.id.desc())
        .limit(min(limit, 500))
        .all()
    )

    return [
        {
            "id": row.id,
            "actor": row.actor,
            "action": row.action,
            "target": row.target,
            "detail": row.detail,
            "created_at": iso(row.created_at),
        }
        for row in rows
    ]


class PurgeRequest(BaseModel):
    older_than_days: int = Field(default=RETENTION_DAYS, ge=0, le=3650)


@router.post("/privacy/purge")
def purge(
    request: PurgeRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    removed = purge_older_than(db, request.older_than_days)

    audit(
        db, admin.email, "manual_purge",
        detail=f"{removed} conversations older than {request.older_than_days} days deleted"
    )
    db.commit()

    return {"success": True, "removed": removed}


class PreviewRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/privacy/preview", dependencies=[Depends(get_current_user)])
def preview(request: PreviewRequest):
    """Show exactly what the AI would receive for a message. Nothing is stored."""

    session_id = f"preview-{uuid.uuid4().hex}"

    masked, redactions = mask_text(request.text, session_id)
    forget_session(session_id)

    return {"masked": masked, "redactions": redactions}
