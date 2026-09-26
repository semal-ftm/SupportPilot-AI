"""
Synthetic demo data. All names, emails and orders are fictional
(example.com addresses) so the demo never contains real customer data.
"""

import json
import os
import random
import uuid

from datetime import timedelta

from auth import hash_password
from config import ADMIN_EMAIL, ADMIN_PASSWORD, AGENT_EMAIL, AGENT_PASSWORD
from database import SessionLocal
from models import (
    AuditLog,
    ChatSession,
    Conversation,
    Customer,
    Feedback,
    Order,
    Ticket,
    TicketEvent,
    User,
)
from sentiment import analyze_sentiment
from utils import audit, utcnow


CUSTOMERS = [
    ("Ali Khan", "ali@example.com"),
    ("Sarah Ahmed", "sarah@example.com"),
    ("Ahmed Raza", "ahmed@example.com"),
    ("Noura Saleh", "noura@example.com"),
    ("Omar Farooq", "omar@example.com"),
    ("Lina Haddad", "lina@example.com"),
]

# order number, customer email, product, amount, status, tracking, delivery, carrier
ORDERS = [
    ("ORD-1001", "ali@example.com", "Wireless Headphones", 129.99, "Shipped", "TRK-100001", "September 29, 2026", "Aramex"),
    ("ORD-1002", "sarah@example.com", "Smart Watch", 249.99, "Delivered", "TRK-100002", "September 15, 2026", "SMSA"),
    ("ORD-1003", "ahmed@example.com", "Laptop", 999.99, "Processing", None, "October 2, 2026", None),
    ("ORD-1004", "noura@example.com", "Espresso Machine", 389.00, "Shipped", "TRK-100004", "September 28, 2026", "DHL"),
    ("ORD-1005", "omar@example.com", "Gaming Keyboard", 89.50, "Delivered", "TRK-100005", "September 20, 2026", "Aramex"),
    ("ORD-1006", "lina@example.com", "Air Purifier", 219.00, "Processing", None, "October 4, 2026", None),
    ("ORD-1007", "ali@example.com", "Phone Case", 19.99, "Delivered", "TRK-100007", "September 12, 2026", "SMSA"),
    ("ORD-1008", "sarah@example.com", "4K Monitor", 459.00, "Out for Delivery", "TRK-100008", "September 26, 2026", "DHL"),
]

DEMO_CONVERSATIONS = [
    {
        "messages": ["Where is order ORD-1001?", "When should it arrive?"],
        "tools": [["get_order_details"], []],
        "reply": "Your order **ORD-1001** has **shipped** with Aramex and should arrive by September 29.",
    },
    {
        "messages": ["Can I return a product after 20 days?"],
        "tools": [["search_knowledge_base"]],
        "reply": "Yes. Our policy allows returns within **30 days** of delivery for unused items.",
    },
    {
        "messages": ["I was charged twice for order ORD-1002. This is unacceptable!"],
        "tools": [["get_order_details", "create_support_ticket"]],
        "reply": "I'm sorry about the duplicate charge. I've created a **high priority** ticket for our billing team.",
        "ticket": ("Duplicate charge on ORD-1002", "Payment", "High", "ORD-1002"),
    },
    {
        "messages": ["How long does standard shipping take?"],
        "tools": [["search_knowledge_base"]],
        "reply": "Standard shipping takes **3 to 5 business days**.",
    },
    {
        "messages": ["My package ORD-1005 says delivered but I never got it"],
        "tools": [["get_order_details", "create_support_ticket"]],
        "reply": "I've escalated this to our delivery team so they can investigate with the carrier.",
        "ticket": ("Package marked delivered but not received", "Delivery", "High", "ORD-1005"),
    },
    {
        "messages": ["Thanks, that was really helpful!"],
        "tools": [[]],
        "reply": "You're welcome! Is there anything else I can help with?",
    },
    {
        "messages": ["Where is my espresso machine? Order ORD-1004"],
        "tools": [["get_order_details"]],
        "reply": "Your order **ORD-1004** has shipped with DHL and should arrive by September 28.",
    },
    {
        "messages": ["The keyboard from ORD-1005 has a broken key, can I get a refund?"],
        "tools": [["search_knowledge_base", "request_refund"]],
        "reply": "I've submitted a refund request for **ORD-1005**. A team member will approve it shortly.",
        "ticket": ("Refund request for ORD-1005", "Refund", "Medium", "ORD-1005"),
    },
    {
        "messages": ["Please cancel ORD-1006"],
        "tools": [["get_order_details"]],
        "reply": "I can help with that. Please confirm the email address used on the order.",
    },
    {
        "messages": ["I want to talk to a human about my warranty"],
        "tools": [["create_support_ticket"]],
        "reply": "Of course. I've created a ticket and a team member will reach out soon.",
        "ticket": ("Customer requested human for warranty question", "Product", "Low", None),
    },
]

TOOL_SUMMARIES = {
    "get_order_details": "Order found",
    "search_knowledge_base": "3 passages from refund_policy.txt",
    "create_support_ticket": "Ticket created",
    "request_refund": "Refund ticket created",
}


def _seed_staff(db):
    if db.query(User).first():
        return

    db.add_all([
        User(
            name="Admin User",
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role="admin",
        ),
        User(
            name="Support Agent",
            email=AGENT_EMAIL,
            password_hash=hash_password(AGENT_PASSWORD),
            role="agent",
        ),
    ])
    db.commit()


def _seed_customers_and_orders(db):
    by_email = {customer.email: customer for customer in db.query(Customer).all()}

    for name, email in CUSTOMERS:
        if email not in by_email:
            customer = Customer(name=name, email=email)
            db.add(customer)
            db.flush()
            by_email[email] = customer

    existing = {order.order_number for order in db.query(Order).all()}

    for number, email, product, amount, status, tracking, delivery, carrier in ORDERS:

        if number in existing:
            order = db.query(Order).filter(Order.order_number == number).first()

            if not order.carrier:
                order.carrier = carrier

            continue

        db.add(
            Order(
                order_number=number,
                customer_id=by_email[email].id,
                product=product,
                amount=amount,
                status=status,
                tracking_number=tracking,
                expected_delivery=delivery,
                carrier=carrier,
            )
        )

    db.commit()


def _backfill_sessions(db):
    """Create session rows for conversations stored by older versions."""

    known = {row.id for row in db.query(ChatSession.id).all()}

    session_ids = {
        row.session_id for row in db.query(Conversation.session_id).distinct()
    }

    for session_id in session_ids - known:
        first = (
            db.query(Conversation)
            .filter(Conversation.session_id == session_id)
            .order_by(Conversation.id)
            .first()
        )

        db.add(
            ChatSession(
                id=session_id,
                channel="console",
                title=(first.message[:60] if first else None),
                created_at=first.created_at if first else utcnow(),
                updated_at=utcnow(),
            )
        )

    db.commit()


def _seed_demo_history(db):
    if db.query(AuditLog).filter(AuditLog.action == "seed_demo").first():
        return

    rng = random.Random(7)
    now = utcnow()
    orders = {order.order_number: order for order in db.query(Order).all()}

    for day in range(13, -1, -1):

        for _ in range(rng.randint(2, 5)):

            demo = rng.choice(DEMO_CONVERSATIONS)
            started = now - timedelta(days=day, hours=rng.randint(0, 20), minutes=rng.randint(0, 59))

            session_id = f"demo-{uuid.uuid4().hex[:12]}"

            db.add(
                ChatSession(
                    id=session_id,
                    title=demo["messages"][0][:60],
                    channel="widget",
                    escalated="ticket" in demo,
                    created_at=started,
                    updated_at=started + timedelta(minutes=3),
                )
            )

            last_reply_id = None

            for position, text in enumerate(demo["messages"]):
                db.add(
                    Conversation(
                        session_id=session_id,
                        role="user",
                        message=text,
                        sentiment=analyze_sentiment(text),
                        created_at=started + timedelta(minutes=position * 2),
                    )
                )

                tools = [
                    {
                        "id": f"call_{name}",
                        "name": name,
                        "args": {},
                        "ok": True,
                        "summary": TOOL_SUMMARIES.get(name, "Done"),
                        "ms": rng.randint(20, 400),
                    }
                    for name in demo["tools"][position]
                ]

                reply = Conversation(
                    session_id=session_id,
                    role="assistant",
                    message=demo["reply"],
                    tools=json.dumps(tools) if tools else None,
                    latency_ms=rng.randint(700, 2600),
                    created_at=started + timedelta(minutes=position * 2 + 1),
                )

                db.add(reply)
                db.flush()
                last_reply_id = reply.id

            if last_reply_id and rng.random() < 0.6:
                db.add(
                    Feedback(
                        message_id=last_reply_id,
                        session_id=session_id,
                        rating=1 if rng.random() < 0.85 else -1,
                        created_at=started + timedelta(minutes=5),
                    )
                )

            if "ticket" in demo:
                title, category, priority, order_number = demo["ticket"]

                status = rng.choice(["Open", "In Progress", "Resolved", "Resolved"])
                if day == 0:
                    status = "Open"

                order = orders.get(order_number)

                ticket = Ticket(
                    title=title,
                    description=f"{demo['messages'][0]} (synthetic demo ticket)",
                    priority=priority,
                    status=status,
                    category=category,
                    sentiment=analyze_sentiment(demo["messages"][0]),
                    order_number=order_number,
                    customer_id=order.customer_id if order else None,
                    session_id=session_id,
                    created_at=started,
                    updated_at=started + timedelta(hours=2),
                    resolved_at=(
                        started + timedelta(hours=rng.randint(2, 30))
                        if status == "Resolved" else None
                    ),
                )

                db.add(ticket)
                db.flush()

                db.add(
                    TicketEvent(
                        ticket_id=ticket.id,
                        kind="event",
                        author="SupportPilot AI",
                        body=f"Ticket created automatically with {priority} priority.",
                        created_at=started,
                    )
                )

    audit(db, "system", "seed_demo", detail="Synthetic demo history created")
    db.commit()


def seed_all():
    db = SessionLocal()

    try:
        _seed_staff(db)
        _backfill_sessions(db)

        # Real installs set SEED_DEMO_DATA=false: staff accounts only
        if os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
            _seed_customers_and_orders(db)
            _seed_demo_history(db)
    finally:
        db.close()
