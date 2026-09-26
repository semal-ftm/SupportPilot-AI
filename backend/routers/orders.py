from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from database import get_db
from models import Customer, Order, Ticket, User
from privacy import mask_email, mask_name
from store import StoreError, get_store, store_info
from utils import audit, ticket_number


router = APIRouter(tags=["Orders"], dependencies=[Depends(get_current_user)])


def serialize_order(order):
    """Store order for staff: customer details masked by default."""

    return {
        "order_number": order["order_number"],
        "product": order["product"],
        "amount": order["amount"],
        "currency": order.get("currency") or "USD",
        "status": order["status"],
        "carrier": order["carrier"],
        "tracking_number": order["tracking_number"],
        "expected_delivery": order["expected_delivery"],
        # Only demo orders have a local customer record that can be revealed
        "customer_id": order.get("customer_id"),
        "customer": (
            {
                "name": mask_name(order["customer_name"]) if order.get("customer_name") else "—",
                "email": mask_email(order["customer_email"]) if order.get("customer_email") else "",
            }
            if order.get("customer_name") or order.get("customer_email") else None
        ),
        "created_at": order.get("created_at"),
    }


def _store_call(callback):
    try:
        return callback(get_store())
    except StoreError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.get("/orders/source")
def order_source():
    return store_info()


@router.get("/orders")
def get_orders(q: str | None = None, status: str | None = None):

    orders = _store_call(lambda store: store.list_orders())

    if status:
        orders = [order for order in orders if order["status"] == status]

    if q:
        term = q.strip().lower()
        orders = [
            order for order in orders
            if term in f"{order['order_number']} {order['product']} {order['tracking_number'] or ''}".lower()
        ]

    return [serialize_order(order) for order in orders]


@router.get("/orders/{order_number}")
def get_order(order_number: str, db: Session = Depends(get_db)):

    order = _store_call(lambda store: store.get_order(order_number))

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    tickets = (
        db.query(Ticket)
        .filter(Ticket.order_number == order["order_number"])
        .order_by(Ticket.id.desc())
        .all()
    )

    return {
        **serialize_order(order),
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


@router.get("/customers")
def get_customers(db: Session = Depends(get_db)):

    order_counts = {}

    for order in db.query(Order).all():
        order_counts[order.customer_id] = order_counts.get(order.customer_id, 0) + 1

    return [
        {
            "id": customer.id,
            "name": mask_name(customer.name),
            "email": mask_email(customer.email),
            "orders": order_counts.get(customer.id, 0),
        }
        for customer in db.query(Customer).order_by(Customer.id).all()
    ]


@router.post("/customers/{customer_id}/reveal")
def reveal_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Full contact details, admin only, and every access is audited."""

    customer = db.get(Customer, customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    audit(db, admin.email, "customer_pii_revealed", target=f"customer:{customer_id}")
    db.commit()

    return {"id": customer.id, "name": customer.name, "email": customer.email}
