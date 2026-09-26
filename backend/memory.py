import json

from database import SessionLocal
from models import ChatSession, Conversation
from utils import iso, utcnow as _now


def ensure_session(session_id, channel="widget", first_message=None):
    db = SessionLocal()

    try:
        session = db.get(ChatSession, session_id)

        if session:
            return session.mode

        title = None

        if first_message:
            title = first_message.strip().replace("\n", " ")[:60]

        db.add(
            ChatSession(
                id=session_id,
                channel=channel,
                title=title,
                mode="ai",
                created_at=_now(),
                updated_at=_now(),
            )
        )
        db.commit()

        return "ai"

    finally:
        db.close()


def save_message(
    session_id: str,
    role: str,
    message: str,
    tools=None,
    sources=None,
    redactions=None,
    sentiment=None,
    author=None,
    latency_ms=None
):
    db = SessionLocal()

    try:
        conversation = Conversation(
            session_id=session_id,
            role=role,
            message=message,
            tools=json.dumps(tools) if tools else None,
            sources=json.dumps(sources) if sources else None,
            redactions=json.dumps(redactions) if redactions else None,
            sentiment=sentiment,
            author=author,
            latency_ms=latency_ms,
            created_at=_now(),
        )

        db.add(conversation)

        session = db.get(ChatSession, session_id)

        if session:
            session.updated_at = _now()

            if role == "user" and sentiment:
                session.sentiment = sentiment

        db.commit()
        db.refresh(conversation)

        return conversation.id

    finally:
        db.close()


def get_conversation_history(
    session_id: str,
    limit: int = 12
):
    """Recent messages in the format the LLM expects."""

    db = SessionLocal()

    try:
        messages = (
            db.query(Conversation)
            .filter(
                Conversation.session_id == session_id,
                Conversation.role.in_(["user", "assistant", "agent"])
            )
            .order_by(
                Conversation.id.desc()
            )
            .limit(limit)
            .all()
        )

        messages.reverse()

        return [
            {
                # Human agent replies are shown to the model as assistant turns
                "role": "user" if item.role == "user" else "assistant",
                "content": item.message
            }
            for item in messages
        ]

    finally:
        db.close()


def serialize_message(item):
    return {
        "id": item.id,
        "role": item.role,
        "text": item.message,
        "tools": json.loads(item.tools) if item.tools else [],
        "sources": json.loads(item.sources) if item.sources else [],
        "redactions": json.loads(item.redactions) if item.redactions else [],
        "sentiment": item.sentiment,
        "author": item.author,
        "latency_ms": item.latency_ms,
        "created_at": iso(item.created_at),
    }
