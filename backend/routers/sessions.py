"""
Staff inbox: browse conversations, take over from the AI, reply as a human.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from database import get_db
from memory import save_message, serialize_message
from models import ChatSession, Conversation, Feedback, Ticket, User
from privacy import forget_session, mask_text
from utils import audit, iso, ticket_number, utcnow


router = APIRouter(tags=["Inbox"], dependencies=[Depends(get_current_user)])


def _session_summary(session, last_message, count):
    return {
        "id": session.id,
        "title": session.title or "New conversation",
        "channel": session.channel,
        "mode": session.mode,
        "escalated": bool(session.escalated),
        "sentiment": session.sentiment or "neutral",
        "assigned_to": session.assigned_to,
        "message_count": count,
        "last_message": (last_message.message[:140] if last_message else ""),
        "last_role": last_message.role if last_message else None,
        "created_at": iso(session.created_at),
        "updated_at": iso(session.updated_at),
    }


@router.get("/sessions")
def list_sessions(
    channel: str | None = None,
    view: str | None = None,
    limit: int = 60,
    db: Session = Depends(get_db)
):
    query = db.query(ChatSession)

    if channel:
        query = query.filter(ChatSession.channel == channel)

    if view == "escalated":
        query = query.filter(ChatSession.escalated.is_(True))
    elif view == "human":
        query = query.filter(ChatSession.mode == "human")
    elif view == "negative":
        query = query.filter(ChatSession.sentiment.in_(["negative", "angry"]))

    sessions = (
        query.order_by(ChatSession.updated_at.desc())
        .limit(min(limit, 200))
        .all()
    )

    ids = [session.id for session in sessions]

    counts = dict(
        db.query(Conversation.session_id, func.count(Conversation.id))
        .filter(Conversation.session_id.in_(ids))
        .group_by(Conversation.session_id)
        .all()
    )

    last_ids = dict(
        db.query(Conversation.session_id, func.max(Conversation.id))
        .filter(Conversation.session_id.in_(ids))
        .group_by(Conversation.session_id)
        .all()
    )

    last_messages = {
        item.session_id: item
        for item in db.query(Conversation)
        .filter(Conversation.id.in_(list(last_ids.values())))
    }

    return [
        _session_summary(session, last_messages.get(session.id), counts.get(session.id, 0))
        for session in sessions
    ]


def _get_session(db, session_id):
    session = db.get(ChatSession, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return session


@router.get("/sessions/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)):

    session = _get_session(db, session_id)

    messages = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id)
        .order_by(Conversation.id)
        .all()
    )

    ratings = dict(
        db.query(Feedback.message_id, Feedback.rating)
        .filter(Feedback.session_id == session_id)
        .all()
    )

    tickets = db.query(Ticket).filter(Ticket.session_id == session_id).all()

    serialized = []

    for item in messages:
        data = serialize_message(item)
        data["rating"] = ratings.get(item.id)
        serialized.append(data)

    return {
        **_session_summary(session, messages[-1] if messages else None, len(messages)),
        "messages": serialized,
        "tickets": [
            {
                "id": ticket.id,
                "number": ticket_number(ticket.id),
                "title": ticket.title,
                "status": ticket.status,
                "priority": ticket.priority,
            }
            for ticket in tickets
        ],
    }


def _system_note(db, session_id, text):
    db.add(
        Conversation(
            session_id=session_id,
            role="system",
            message=text,
            created_at=utcnow()
        )
    )


@router.post("/sessions/{session_id}/takeover")
def take_over(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    session = _get_session(db, session_id)

    session.mode = "human"
    session.assigned_to = user.name
    session.updated_at = utcnow()

    _system_note(db, session_id, f"{user.name} joined the conversation")
    db.commit()

    return {"success": True, "mode": "human"}


@router.post("/sessions/{session_id}/release")
def release(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    session = _get_session(db, session_id)

    session.mode = "ai"
    session.updated_at = utcnow()

    _system_note(db, session_id, "SupportPilot AI resumed the conversation")
    db.commit()

    return {"success": True, "mode": "ai"}


class ReplyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("/sessions/{session_id}/reply")
def reply(
    session_id: str,
    request: ReplyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    session = _get_session(db, session_id)

    # Replying implies taking over, so the AI does not answer on top of a human
    if session.mode != "human":
        session.mode = "human"
        session.assigned_to = user.name
        _system_note(db, session_id, f"{user.name} joined the conversation")

    db.commit()

    masked, _ = mask_text(request.text, session_id)

    message_id = save_message(
        session_id=session_id,
        role="agent",
        message=masked,
        author=user.name
    )

    return {"success": True, "message_id": message_id}


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    session = _get_session(db, session_id)

    message_ids = [
        row.id for row in
        db.query(Conversation.id).filter(Conversation.session_id == session_id)
    ]

    db.query(Feedback).filter(Feedback.message_id.in_(message_ids)).delete(
        synchronize_session=False
    )
    db.query(Conversation).filter(Conversation.session_id == session_id).delete()
    db.delete(session)

    audit(db, admin.email, "conversation_deleted", target=session_id)
    db.commit()

    forget_session(session_id)

    return {"success": True}
