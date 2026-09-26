from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ai_service import generate_ticket_assist
from auth import get_current_user
from database import get_db
from memory import serialize_message
from models import Conversation, Customer, Ticket, TicketEvent, User
from notify import urgent_ticket_alert
from privacy import mask_email, mask_name
from store import StoreError, get_store
from utils import iso, ticket_number, utcnow


router = APIRouter(tags=["Tickets"], dependencies=[Depends(get_current_user)])

STATUSES = ["Open", "In Progress", "Resolved"]
PRIORITIES = ["Low", "Medium", "High"]
CATEGORIES = ["Payment", "Delivery", "Refund", "Product", "Account", "Other"]


def serialize_ticket(ticket, users, customers):
    customer = customers.get(ticket.customer_id)
    assignee = users.get(ticket.assignee_id)

    return {
        "id": ticket.id,
        "number": ticket_number(ticket.id),
        "title": ticket.title,
        "description": ticket.description,
        "order_number": ticket.order_number,
        "priority": ticket.priority,
        "status": ticket.status,
        "category": ticket.category or "Other",
        "sentiment": ticket.sentiment or "neutral",
        "session_id": ticket.session_id,
        "assignee_id": ticket.assignee_id,
        "assignee": assignee.name if assignee else None,
        # Staff see a masked identity by default (data minimisation)
        "customer": (
            {"name": mask_name(customer.name), "email": mask_email(customer.email)}
            if customer else None
        ),
        "ai_summary": ticket.ai_summary,
        "created_at": iso(ticket.created_at),
        "updated_at": iso(ticket.updated_at),
        "resolved_at": iso(ticket.resolved_at),
    }


def _lookups(db):
    users = {user.id: user for user in db.query(User).all()}
    customers = {customer.id: customer for customer in db.query(Customer).all()}

    return users, customers


def _get_ticket(db, ticket_id):
    ticket = db.get(Ticket, ticket_id)

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return ticket


def _event(db, ticket_id, author, body, kind="event"):
    db.add(
        TicketEvent(
            ticket_id=ticket_id,
            kind=kind,
            author=author,
            body=body,
            created_at=utcnow()
        )
    )


@router.get("/tickets")
def get_tickets(
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)

    if status:
        query = query.filter(Ticket.status == status)

    if priority:
        query = query.filter(Ticket.priority == priority)

    if category:
        query = query.filter(Ticket.category == category)

    if q:
        term = f"%{q.strip()}%"
        digits = "".join(c for c in q if c.isdigit())

        conditions = [
            Ticket.title.ilike(term),
            Ticket.description.ilike(term),
            Ticket.order_number.ilike(term),
        ]

        if digits:
            conditions.append(Ticket.id == int(digits))

        query = query.filter(or_(*conditions))

    users, customers = _lookups(db)

    return [
        serialize_ticket(ticket, users, customers)
        for ticket in query.order_by(Ticket.id.desc()).all()
    ]


class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    priority: str = "Medium"
    category: str = "Other"
    order_number: str | None = None


@router.post("/tickets")
def create_ticket(
    request: TicketCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if request.priority not in PRIORITIES or request.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid priority or category")

    customer_id = None
    order_number = (request.order_number or "").strip().upper() or None

    if order_number:
        try:
            order = get_store().get_order(order_number)
        except StoreError:
            # Store offline: still let staff record the ticket
            order = {"order_number": order_number}

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        order_number = order["order_number"]
        customer_id = order.get("customer_id")

    ticket = Ticket(
        title=request.title,
        description=request.description,
        priority=request.priority,
        category=request.category,
        order_number=order_number,
        customer_id=customer_id,
        status="Open",
        created_at=utcnow(),
        updated_at=utcnow(),
    )

    db.add(ticket)
    db.flush()

    _event(db, ticket.id, user.name, "Ticket created manually.")
    db.commit()

    if ticket.priority == "High":
        urgent_ticket_alert(ticket.id, ticket.title)

    users, customers = _lookups(db)

    return serialize_ticket(ticket, users, customers)


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):

    ticket = _get_ticket(db, ticket_id)
    users, customers = _lookups(db)

    events = (
        db.query(TicketEvent)
        .filter(TicketEvent.ticket_id == ticket_id)
        .order_by(TicketEvent.id)
        .all()
    )

    messages = []

    if ticket.session_id:
        messages = [
            serialize_message(item)
            for item in db.query(Conversation)
            .filter(Conversation.session_id == ticket.session_id)
            .order_by(Conversation.id)
        ]

    order = None

    if ticket.order_number:
        try:
            found = get_store().get_order(ticket.order_number)
        except StoreError:
            found = None

        if found:
            order = {
                key: found.get(key)
                for key in (
                    "order_number", "product", "amount", "currency", "status",
                    "carrier", "tracking_number", "expected_delivery",
                )
            }

    return {
        **serialize_ticket(ticket, users, customers),
        "events": [
            {
                "id": event.id,
                "kind": event.kind,
                "author": event.author,
                "body": event.body,
                "created_at": iso(event.created_at),
            }
            for event in events
        ],
        "messages": messages,
        "order": order,
    }


class TicketUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    assignee_id: int | None = None
    unassign: bool = False


@router.patch("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: int,
    update: TicketUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    ticket = _get_ticket(db, ticket_id)

    if update.status and update.status != ticket.status:

        if update.status not in STATUSES:
            raise HTTPException(status_code=400, detail="Invalid ticket status")

        _event(db, ticket.id, user.name, f"Status changed from {ticket.status} to {update.status}.")

        ticket.status = update.status
        ticket.resolved_at = utcnow() if update.status == "Resolved" else None

    if update.priority and update.priority != ticket.priority:

        if update.priority not in PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority")

        _event(db, ticket.id, user.name, f"Priority changed from {ticket.priority} to {update.priority}.")
        ticket.priority = update.priority

        if update.priority == "High":
            urgent_ticket_alert(ticket.id, ticket.title)

    if update.unassign and ticket.assignee_id:
        _event(db, ticket.id, user.name, "Ticket unassigned.")
        ticket.assignee_id = None

    elif update.assignee_id and update.assignee_id != ticket.assignee_id:
        assignee = db.get(User, update.assignee_id)

        if not assignee:
            raise HTTPException(status_code=404, detail="User not found")

        _event(db, ticket.id, user.name, f"Assigned to {assignee.name}.")
        ticket.assignee_id = assignee.id

    ticket.updated_at = utcnow()
    db.commit()

    users, customers = _lookups(db)

    return serialize_ticket(ticket, users, customers)


class TicketStatusUpdate(BaseModel):
    status: str


@router.patch("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    update: TicketStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return update_ticket(ticket_id, TicketUpdate(status=update.status), db, user)


class NoteRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


@router.post("/tickets/{ticket_id}/notes")
def add_note(
    ticket_id: int,
    request: NoteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    ticket = _get_ticket(db, ticket_id)

    _event(db, ticket.id, user.name, request.body, kind="note")
    ticket.updated_at = utcnow()
    db.commit()

    return {"success": True}


@router.post("/tickets/{ticket_id}/assist")
def ticket_assist(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    ticket = _get_ticket(db, ticket_id)

    transcript = []

    if ticket.session_id:
        transcript = [
            {"role": item.role, "text": item.message}
            for item in db.query(Conversation)
            .filter(
                Conversation.session_id == ticket.session_id,
                Conversation.role.in_(["user", "assistant", "agent"])
            )
            .order_by(Conversation.id)
        ]

    try:
        result = generate_ticket_assist(
            {
                "title": ticket.title,
                "description": ticket.description,
                "priority": ticket.priority,
                "status": ticket.status,
                "category": ticket.category,
                "order_number": ticket.order_number,
            },
            transcript
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))
    except Exception:
        raise HTTPException(status_code=502, detail="AI assist is temporarily unavailable")

    ticket.ai_summary = result["summary"]
    _event(db, ticket.id, user.name, "Generated an AI summary and draft reply.")
    db.commit()

    return result
