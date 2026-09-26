import json

from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ChatSession, Conversation, Feedback, Ticket, TicketEvent
from utils import days_ago, iso, ticket_number, utcnow


router = APIRouter(tags=["Analytics"], dependencies=[Depends(get_current_user)])


def _rate(part, whole):
    return round(part / whole * 100, 1) if whole else None


def _period(db, start, end):
    sessions = (
        db.query(ChatSession)
        .filter(
            ChatSession.channel == "widget",
            ChatSession.created_at >= start,
            ChatSession.created_at < end
        )
        .all()
    )

    tickets = (
        db.query(Ticket)
        .filter(Ticket.created_at >= start, Ticket.created_at < end)
        .all()
    )

    feedback = (
        db.query(Feedback)
        .filter(Feedback.created_at >= start, Feedback.created_at < end)
        .all()
    )

    escalated = sum(1 for session in sessions if session.escalated)
    helpful = sum(1 for item in feedback if item.rating > 0)

    return {
        "sessions": sessions,
        "tickets": tickets,
        "conversations": len(sessions),
        "ai_resolution_rate": _rate(len(sessions) - escalated, len(sessions)),
        "csat": _rate(helpful, len(feedback)),
        "feedback_count": len(feedback),
        "tickets_created": len(tickets),
    }


def _change(current, previous):
    if current is None or previous in (None, 0):
        return None

    return round((current - previous) / previous * 100, 1)


@router.get("/analytics/overview")
def overview(days: int = 14, db: Session = Depends(get_db)):

    days = max(1, min(days, 90))

    end = utcnow() + timedelta(minutes=1)
    start = days_ago(days)

    current = _period(db, start, end)
    previous = _period(db, days_ago(days * 2), start)

    all_tickets = db.query(Ticket).all()

    open_tickets = [t for t in all_tickets if t.status == "Open"]
    in_progress = [t for t in all_tickets if t.status == "In Progress"]

    resolved_times = [
        (t.resolved_at - t.created_at).total_seconds() / 3600
        for t in current["tickets"]
        if t.resolved_at and t.created_at
    ]

    assistant_messages = (
        db.query(Conversation)
        .filter(Conversation.role == "assistant", Conversation.created_at >= start)
        .all()
    )

    user_messages = (
        db.query(Conversation)
        .filter(Conversation.role == "user", Conversation.created_at >= start)
        .all()
    )

    tool_usage = Counter()

    for message in assistant_messages:
        for tool in json.loads(message.tools) if message.tools else []:
            tool_usage[tool["name"] if isinstance(tool, dict) else str(tool).split("(")[0]] += 1

    latencies = [m.latency_ms for m in assistant_messages if m.latency_ms]

    redaction_types = Counter()

    for message in user_messages:
        for item in json.loads(message.redactions) if message.redactions else []:
            redaction_types[item["type"]] += 1

    sentiment = Counter(m.sentiment or "neutral" for m in user_messages)

    # Daily series
    series = []

    for offset in range(days - 1, -1, -1):
        day_start = (utcnow() - timedelta(days=offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)

        day_sessions = [
            s for s in current["sessions"]
            if s.created_at and day_start <= s.created_at < day_end
        ]

        series.append({
            "date": day_start.date().isoformat(),
            "conversations": len(day_sessions),
            "escalated": sum(1 for s in day_sessions if s.escalated),
            "resolved_by_ai": sum(1 for s in day_sessions if not s.escalated),
            "tickets": sum(
                1 for t in current["tickets"]
                if t.created_at and day_start <= t.created_at < day_end
            ),
        })

    categories = Counter((t.category or "Other") for t in current["tickets"])

    recent_events = (
        db.query(TicketEvent)
        .order_by(TicketEvent.id.desc())
        .limit(8)
        .all()
    )

    ticket_titles = {t.id: t.title for t in all_tickets}

    return {
        "range_days": days,
        "kpis": {
            "conversations": current["conversations"],
            "conversations_change": _change(current["conversations"], previous["conversations"]),
            "ai_resolution_rate": current["ai_resolution_rate"],
            "ai_resolution_change": _change(current["ai_resolution_rate"], previous["ai_resolution_rate"]),
            "csat": current["csat"],
            "csat_change": _change(current["csat"], previous["csat"]),
            "feedback_count": current["feedback_count"],
            "tickets_created": current["tickets_created"],
            "open_tickets": len(open_tickets),
            "in_progress_tickets": len(in_progress),
            "high_priority_open": sum(1 for t in open_tickets + in_progress if t.priority == "High"),
            "avg_resolution_hours": (
                round(sum(resolved_times) / len(resolved_times), 1) if resolved_times else None
            ),
            "avg_response_ms": int(sum(latencies) / len(latencies)) if latencies else None,
            "pii_redactions": sum(redaction_types.values()),
        },
        "series": series,
        "tool_usage": [
            {"name": name, "count": count} for name, count in tool_usage.most_common()
        ],
        "categories": [
            {"name": name, "count": count} for name, count in categories.most_common()
        ],
        "sentiment": [
            {"name": name, "count": sentiment.get(name, 0)}
            for name in ["positive", "neutral", "negative", "angry"]
        ],
        "redactions": [
            {"type": name, "count": count} for name, count in redaction_types.most_common()
        ],
        "activity": [
            {
                "id": event.id,
                "ticket_id": event.ticket_id,
                "ticket_number": ticket_number(event.ticket_id),
                "ticket_title": ticket_titles.get(event.ticket_id, ""),
                "author": event.author,
                "body": event.body,
                "kind": event.kind,
                "created_at": iso(event.created_at),
            }
            for event in recent_events
        ],
    }
