from database import SessionLocal
from models import Order, Ticket


def get_order_details(order_number: str):
    db = SessionLocal()

    try:
        order = (
            db.query(Order)
            .filter(Order.order_number == order_number)
            .first()
        )

        if not order:
            return {
                "success": False,
                "message": "Order not found"
            }

        return {
            "success": True,
            "order_number": order.order_number,
            "customer_id": order.customer_id,
            "product": order.product,
            "amount": order.amount,
            "status": order.status,
            "tracking_number": order.tracking_number,
            "expected_delivery": order.expected_delivery
        }

    finally:
        db.close()


def create_support_ticket(
    title: str,
    description: str,
    priority: str = "Medium",
    order_number: str = None
):
    db = SessionLocal()

    try:
        customer_id = None

        # If an order number is provided,
        # find the customer linked to that order.
        if order_number:

            order = (
                db.query(Order)
                .filter(Order.order_number == order_number)
                .first()
            )

            if order:
                customer_id = order.customer_id

        ticket = Ticket(
            customer_id=customer_id,
            order_number=order_number,
            title=title,
            description=description,
            priority=priority,
            status="Open"
        )

        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        ticket_number = f"TKT-{ticket.id:04d}"

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