from database import SessionLocal
from models import ChatSession, Customer, Order, Ticket, TicketEvent
from notify import urgent_ticket_alert
from store import StoreError, get_store
from utils import iso, utcnow


CANCELLABLE_STATUSES = ["Processing"]
REFUNDABLE_STATUSES = ["Delivered"]


def _find_order(db, order_number):
    return (
        db.query(Order)
        .filter(Order.order_number == order_number.strip().upper())
        .first()
    )


def _verify_owner(db, order, customer_email):
    """Actions that change an order require the customer's email."""

    if not customer_email:
        return False

    customer = db.get(Customer, order.customer_id)

    return (
        customer is not None
        and customer.email.lower() == customer_email.strip().lower()
    )


def _store_order(order_number):
    """(store, order) from the connected store; order is None if missing."""

    store = get_store()
    return store, store.get_order(order_number)


def _email_matches(order, customer_email):
    return bool(
        customer_email
        and order.get("customer_email")
        and order["customer_email"].strip().lower() == customer_email.strip().lower()
    )


IDENTITY_FAILED = {
    "success": False,
    "message": (
        "Identity check failed. Ask the customer for the email "
        "address used on the order."
    )
}

STORE_UNAVAILABLE = (
    "The order system is not reachable right now. Apologise, and offer "
    "to create a support ticket so the team can follow up."
)


def get_order_details(order_number: str):
    try:
        _, order = _store_order(order_number)
    except StoreError:
        return {"success": False, "message": STORE_UNAVAILABLE}

    if not order:
        return {
            "success": False,
            "message": "Order not found"
        }

    # No customer personal data is returned to the model
    return {
        "success": True,
        "order_number": order["order_number"],
        "product": order["product"],
        "amount": order["amount"],
        "currency": order.get("currency"),
        "status": order["status"],
        "carrier": order["carrier"],
        "tracking_number": order["tracking_number"],
        "expected_delivery": order["expected_delivery"]
    }


def create_support_ticket(
    title: str,
    description: str,
    priority: str = "Medium",
    order_number: str = None,
    category: str = "Other",
    session_id: str = None,
    sentiment: str = "neutral"
):
    db = SessionLocal()

    try:
        customer_id = None

        # If an order number is provided,
        # find the customer linked to that order.
        if order_number:

            order = _find_order(db, order_number)

            if order:
                customer_id = order.customer_id
                order_number = order.order_number

        # Angry customers are always handled first
        if sentiment == "angry" and priority != "High":
            priority = "High"

        ticket = Ticket(
            customer_id=customer_id,
            order_number=order_number,
            title=title,
            description=description,
            priority=priority,
            category=category,
            sentiment=sentiment,
            session_id=session_id,
            status="Open",
            updated_at=utcnow()
        )

        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        db.add(
            TicketEvent(
                ticket_id=ticket.id,
                kind="event",
                author="SupportPilot AI",
                body=f"Ticket created automatically with {priority} priority."
            )
        )

        if session_id:
            session = db.get(ChatSession, session_id)

            if session:
                session.escalated = True

        db.commit()

        ticket_number = f"TKT-{ticket.id:04d}"

        if ticket.priority == "High":
            urgent_ticket_alert(ticket.id, ticket.title)

        return {
            "success": True,
            "ticket_number": ticket_number,
            "title": ticket.title,
            "priority": ticket.priority,
            "status": ticket.status,
            "order_number": ticket.order_number,
            "message": "Support ticket created successfully."
        }

    finally:
        db.close()


def _store_request(kind, order_number, customer_email, reason, session_id, sentiment):
    """
    Real stores are never changed directly. After the identity check, the
    request becomes a ticket so a person completes it in the store admin.
    """

    try:
        store, order = _store_order(order_number)
    except StoreError:
        return {"success": False, "message": STORE_UNAVAILABLE}

    if not order:
        return {"success": False, "message": "Order not found"}

    if not _email_matches(order, customer_email):
        return IDENTITY_FAILED

    label = "Cancellation" if kind == "cancel" else "Refund"

    ticket = create_support_ticket(
        title=f"{label} request for {order['order_number']}",
        description=reason or f"Customer asked to {kind} this order (current status: {order['status']}).",
        priority="Medium",
        order_number=order["order_number"],
        category="Refund",
        session_id=session_id,
        sentiment=sentiment
    )

    return {
        "success": True,
        "order_number": order["order_number"],
        "status": order["status"],
        "ticket_number": ticket["ticket_number"],
        "message": (
            f"{label} request sent to the team for approval. Tell the "
            "customer they will get a confirmation once it is processed."
        )
    }


def cancel_order(
    order_number: str,
    customer_email: str = None,
    session_id: str = None,
    sentiment: str = "neutral"
):
    if get_store().read_only:
        return _store_request("cancel", order_number, customer_email, None, session_id, sentiment)

    db = SessionLocal()

    try:
        order = _find_order(db, order_number)

        if not order:
            return {"success": False, "message": "Order not found"}

        if not _verify_owner(db, order, customer_email):
            return {
                "success": False,
                "message": (
                    "Identity check failed. Ask the customer for the email "
                    "address used on the order."
                )
            }

        if order.status not in CANCELLABLE_STATUSES:
            return {
                "success": False,
                "message": (
                    f"Order is '{order.status}' and can no longer be "
                    "cancelled. Offer a return instead."
                )
            }

        order.status = "Cancelled"
        db.commit()

        return {
            "success": True,
            "order_number": order.order_number,
            "status": order.status,
            "message": "Order cancelled. The refund is issued to the original payment method."
        }

    finally:
        db.close()


def request_refund(
    order_number: str,
    reason: str,
    customer_email: str = None,
    session_id: str = None,
    sentiment: str = "neutral"
):
    if get_store().read_only:
        return _store_request("refund", order_number, customer_email, reason, session_id, sentiment)

    db = SessionLocal()

    try:
        order = _find_order(db, order_number)

        if not order:
            return {"success": False, "message": "Order not found"}

        if not _verify_owner(db, order, customer_email):
            return IDENTITY_FAILED

        if order.status not in REFUNDABLE_STATUSES:
            return {
                "success": False,
                "message": (
                    f"Order is '{order.status}'. Refund requests are only "
                    "possible after delivery."
                )
            }

        order.status = "Refund Requested"
        db.commit()

        order_number = order.order_number

    finally:
        db.close()

    # Refunds always get a human approval step
    ticket = create_support_ticket(
        title=f"Refund request for {order_number}",
        description=reason,
        priority="Medium",
        order_number=order_number,
        category="Refund",
        session_id=session_id,
        sentiment=sentiment
    )

    return {
        "success": True,
        "order_number": order_number,
        "status": "Refund Requested",
        "ticket_number": ticket["ticket_number"],
        "message": "Refund request submitted for human approval."
    }


def check_ticket_status(ticket_number: str, session_id: str = None):
    db = SessionLocal()

    try:
        digits = "".join(c for c in ticket_number if c.isdigit())

        if not digits:
            return {"success": False, "message": "Invalid ticket number"}

        ticket = db.get(Ticket, int(digits))

        if not ticket:
            return {"success": False, "message": "Ticket not found"}

        # Ticket numbers are guessable, so other people's ticket titles
        # (which can describe their problem) are never revealed.
        if not session_id or ticket.session_id != session_id:
            return {
                "success": True,
                "ticket_number": f"TKT-{ticket.id:04d}",
                "status": ticket.status,
                "note": "Details are only shared in the conversation that created this ticket."
            }

        return {
            "success": True,
            "ticket_number": f"TKT-{ticket.id:04d}",
            "title": ticket.title,
            "status": ticket.status,
            "priority": ticket.priority,
            "last_updated": iso(ticket.updated_at or ticket.created_at)
        }

    finally:
        db.close()
