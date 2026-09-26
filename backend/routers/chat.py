"""
Public chat endpoints used by the customer widget and the staff console.
"""

import json
import logging
import threading
import time
import uuid

from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ai_service import run_agent
from database import get_db
from memory import (
    ensure_session,
    get_conversation_history,
    save_message,
    serialize_message,
)
from models import ChatSession, Conversation, Feedback
from privacy import forget_session, mask_text
from sentiment import analyze_sentiment
from utils import audit


router = APIRouter(tags=["Chat"])

logger = logging.getLogger("supportpilot.chat")


# ---------------------------------------------------
# SIMPLE PER-IP RATE LIMIT
# ---------------------------------------------------

RATE_LIMIT = 20
RATE_WINDOW_SECONDS = 60

_requests = defaultdict(deque)
_rate_lock = threading.Lock()


def rate_limit(request: Request):
    client = request.client.host if request.client else "unknown"
    now = time.time()

    with _rate_lock:
        hits = _requests[client]

        while hits and hits[0] < now - RATE_WINDOW_SECONDS:
            hits.popleft()

        if len(hits) >= RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Too many messages. Please wait a moment."
            )

        hits.append(now)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=64)
    channel: str = "widget"


def _prepare(request: ChatRequest):
    session_id = request.session_id or uuid.uuid4().hex
    channel = request.channel if request.channel in ("widget", "console") else "widget"

    # Sentiment runs locally on the raw text; everything stored is masked
    sentiment = analyze_sentiment(request.message)
    masked, redactions = mask_text(request.message, session_id)

    mode = ensure_session(session_id, channel, first_message=masked)
    history = get_conversation_history(session_id)

    user_message_id = save_message(
        session_id=session_id,
        role="user",
        message=masked,
        redactions=redactions,
        sentiment=sentiment
    )

    return {
        "session_id": session_id,
        "sentiment": sentiment,
        "masked": masked,
        "redactions": redactions,
        "mode": mode,
        "history": history,
        "user_message_id": user_message_id,
    }


HANDOFF_TEXT = "A support specialist is handling this conversation and will reply here shortly."


@router.post("/chat/stream", dependencies=[Depends(rate_limit)])
def chat_stream(request: ChatRequest):
    """
    Streams newline-delimited JSON events:
    meta, tool_start, tool_end, sources, token, done, handoff, error
    """

    context = _prepare(request)
    session_id = context["session_id"]

    def events():
        yield {
            "type": "meta",
            "session_id": session_id,
            "user_message_id": context["user_message_id"],
            "masked_text": context["masked"],
            "redactions": context["redactions"],
            "sentiment": context["sentiment"],
            "mode": context["mode"],
        }

        # A human has taken over: the AI stays quiet
        if context["mode"] == "human":
            yield {"type": "handoff", "text": HANDOFF_TEXT}
            return

        started = time.perf_counter()

        try:
            for event in run_agent(
                context["masked"],
                context["history"],
                session_id,
                context["sentiment"]
            ):
                if event["type"] != "final":
                    yield event
                    continue

                latency = int((time.perf_counter() - started) * 1000)

                message_id = save_message(
                    session_id=session_id,
                    role="assistant",
                    message=event["text"],
                    tools=event["tools"],
                    sources=event["sources"],
                    latency_ms=latency
                )

                yield {
                    "type": "done",
                    "message_id": message_id,
                    "text": event["text"],
                    "tools": event["tools"],
                    "sources": event["sources"],
                    "latency_ms": latency,
                }

        except RuntimeError as error:
            yield {"type": "error", "message": str(error)}

        except Exception:
            logger.exception("Agent failed")
            yield {
                "type": "error",
                "message": "The AI agent is temporarily unavailable. Please try again."
            }

    def encode():
        for event in events():
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        encode(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.post("/chat", dependencies=[Depends(rate_limit)])
def chat(request: ChatRequest):
    """Non-streaming version, kept for Swagger testing and simple clients."""

    context = _prepare(request)
    session_id = context["session_id"]

    if context["mode"] == "human":
        return {
            "message": request.message,
            "response": HANDOFF_TEXT,
            "tool_used": [],
            "session_id": session_id,
        }

    final = None

    try:
        for event in run_agent(
            context["masked"], context["history"], session_id, context["sentiment"]
        ):
            if event["type"] == "final":
                final = event

    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))

    save_message(
        session_id=session_id,
        role="assistant",
        message=final["text"],
        tools=final["tools"],
        sources=final["sources"]
    )

    return {
        "message": request.message,
        "response": final["text"],
        "tool_used": final["tools"],
        "sources": final["sources"],
        "redactions": context["redactions"],
        "session_id": session_id
    }


# ---------------------------------------------------
# CUSTOMER SESSION ENDPOINTS
# The random session id acts as the customer's access key.
# ---------------------------------------------------

@router.get("/public/sessions/{session_id}/messages")
def public_messages(
    session_id: str,
    after: int = 0,
    db: Session = Depends(get_db)
):
    session = db.get(ChatSession, session_id)

    if not session:
        return {"mode": "ai", "messages": []}

    messages = (
        db.query(Conversation)
        .filter(
            Conversation.session_id == session_id,
            Conversation.id > after,
            Conversation.role.in_(["user", "assistant", "agent", "system"])
        )
        .order_by(Conversation.id)
        .all()
    )

    return {
        "mode": session.mode,
        "assigned_to": session.assigned_to,
        "messages": [serialize_message(item) for item in messages]
    }


@router.delete("/public/sessions/{session_id}")
def delete_own_conversation(session_id: str, db: Session = Depends(get_db)):
    """Lets a customer erase their own conversation (right to erasure)."""

    session = db.get(ChatSession, session_id)

    if not session:
        return {"success": True}

    message_ids = [
        row.id for row in
        db.query(Conversation.id).filter(Conversation.session_id == session_id)
    ]

    db.query(Feedback).filter(Feedback.message_id.in_(message_ids)).delete(
        synchronize_session=False
    )
    db.query(Conversation).filter(Conversation.session_id == session_id).delete()
    db.delete(session)

    audit(db, "customer", "conversation_erased", target=session_id)
    db.commit()

    forget_session(session_id)

    return {"success": True}


class FeedbackRequest(BaseModel):
    message_id: int
    session_id: str
    rating: int = Field(ge=-1, le=1)


@router.post("/feedback")
def submit_feedback(request: FeedbackRequest, db: Session = Depends(get_db)):

    message = db.get(Conversation, request.message_id)

    if not message or message.session_id != request.session_id:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = (
        db.query(Feedback)
        .filter(Feedback.message_id == request.message_id)
        .first()
    )

    if request.rating == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.rating = request.rating
    else:
        db.add(
            Feedback(
                message_id=request.message_id,
                session_id=request.session_id,
                rating=request.rating
            )
        )

    db.commit()

    return {"success": True}
