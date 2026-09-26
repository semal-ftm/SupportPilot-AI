from datetime import datetime, timedelta, timezone

from models import AuditLog


def utcnow():
    """Naive UTC timestamp, matching how SQLite stores DateTime columns."""

    return datetime.now(timezone.utc).replace(tzinfo=None)


def days_ago(days):
    return utcnow() - timedelta(days=days)


def iso(value):
    """Serialize timestamps so browsers always read them as UTC."""

    if value is None:
        return None

    if value.tzinfo is None:
        return value.isoformat() + "Z"

    return value.isoformat()


def ticket_number(ticket_id):
    return f"TKT-{ticket_id:04d}"


def audit(db, actor, action, target=None, detail=None):
    db.add(
        AuditLog(
            actor=actor,
            action=action,
            target=target,
            detail=detail,
            created_at=utcnow()
        )
    )
