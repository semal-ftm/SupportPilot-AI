import os
import shutil

from fastapi import UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from rag import add_document

from pydantic import BaseModel
from ai_service import generate_support_response

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal, get_db
from models import Customer, Order, Ticket
from memory import (
    save_message,
    get_conversation_history
)


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="SupportPilot AI",
    description="Agentic AI Customer Support System",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "SupportPilot AI Backend is running",
        "status": "success"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.on_event("startup")
def add_sample_data():

    db = SessionLocal()

    try:

        existing_customer = db.query(Customer).first()

        if existing_customer:
            return

        customer1 = Customer(
            name="Ali Khan",
            email="ali@example.com"
        )

        customer2 = Customer(
            name="Sarah Ahmed",
            email="sarah@example.com"
        )

        customer3 = Customer(
            name="Ahmed Raza",
            email="ahmed@example.com"
        )

        db.add_all([
            customer1,
            customer2,
            customer3
        ])

        db.commit()

        db.refresh(customer1)
        db.refresh(customer2)
        db.refresh(customer3)

        order1 = Order(
            order_number="ORD-1001",
            customer_id=customer1.id,
            product="Wireless Headphones",
            amount=129.99,
            status="Shipped",
            tracking_number="TRK-100001",
            expected_delivery="September 19, 2026"
        )

        order2 = Order(
            order_number="ORD-1002",
            customer_id=customer2.id,
            product="Smart Watch",
            amount=249.99,
            status="Delivered",
            tracking_number="TRK-100002",
            expected_delivery="September 15, 2026"
        )

        order3 = Order(
            order_number="ORD-1003",
            customer_id=customer3.id,
            product="Laptop",
            amount=999.99,
            status="Processing",
            tracking_number=None,
            expected_delivery="September 22, 2026"
        )

        db.add_all([
            order1,
            order2,
            order3
        ])

        db.commit()

        print("Sample customer and order data added.")

    finally:
        db.close()


@app.get("/customers")
def get_customers(
    db: Session = Depends(get_db)
):

    customers = db.query(Customer).all()

    return customers


@app.get("/orders")
def get_orders(
    db: Session = Depends(get_db)
):

    orders = db.query(Order).all()

    return orders


@app.get("/orders/{order_number}")
def get_order(
    order_number: str,
    db: Session = Depends(get_db)
):

    order = (
        db.query(Order)
        .filter(
            Order.order_number == order_number
        )
        .first()
    )

    if not order:

        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    return order


@app.get("/tickets")
def get_tickets(
    db: Session = Depends(get_db)
):

    tickets = db.query(Ticket).all()

    return tickets


# ---------------------------------------------------
# TICKET STATUS UPDATE
# ---------------------------------------------------

class TicketStatusUpdate(BaseModel):
    status: str


@app.patch("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    update: TicketStatusUpdate,
    db: Session = Depends(get_db)
):

    allowed_statuses = [
        "Open",
        "In Progress",
        "Resolved"
    ]

    if update.status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail="Invalid ticket status"
        )

    ticket = (
        db.query(Ticket)
        .filter(
            Ticket.id == ticket_id
        )
        .first()
    )

    if not ticket:

        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    ticket.status = update.status

    db.commit()
    db.refresh(ticket)

    return {
        "success": True,
        "ticket_id": ticket.id,
        "status": ticket.status,
        "message": "Ticket status updated successfully"
    }


# ---------------------------------------------------
# CHAT REQUEST
# ---------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    session_id: str = "demo-session"


@app.post("/chat")
def chat(request: ChatRequest):

    history = get_conversation_history(
        request.session_id
    )

    save_message(
        session_id=request.session_id,
        role="user",
        message=request.message
    )

    result = generate_support_response(
        message=request.message,
        history=history
    )

    save_message(
        session_id=request.session_id,
        role="assistant",
        message=result["response"]
    )

    return {
        "message": request.message,
        "response": result["response"],
        "tool_used": result["tool_used"],
        "session_id": request.session_id
    }


@app.post("/knowledge/upload")
def upload_knowledge_document(
    file: UploadFile = File(...)
):

    os.makedirs(
        "uploads",
        exist_ok=True
    )

    safe_filename = os.path.basename(
        file.filename
    )

    file_path = os.path.join(
        "uploads",
        safe_filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    try:

        chunk_count = add_document(
            file_path,
            safe_filename
        )

        return {
            "success": True,
            "filename": safe_filename,
            "chunks_created": chunk_count,
            "message":
                "Document added to the knowledge base."
        }

    except Exception as error:

        return {
            "success": False,
            "error": str(error)
        }