from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text
)

from sqlalchemy.sql import func

from database import Base


class User(Base):
    """Support staff who sign in to the dashboard."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # "admin" or "agent"
    role = Column(String, nullable=False, default="agent")

    # Removed team members are deactivated rather than deleted, so their
    # name stays on old tickets. NULL (older databases) counts as active.
    active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    product = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    tracking_number = Column(String, nullable=True)
    expected_delivery = Column(String, nullable=True)
    carrier = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    order_number = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    priority = Column(String, default="Medium")
    status = Column(String, default="Open")

    # Payment, Delivery, Refund, Product, Account, Other
    category = Column(String, nullable=True, default="Other")

    # positive, neutral, negative, angry
    sentiment = Column(String, nullable=True, default="neutral")

    # Conversation that led to the escalation
    session_id = Column(String, nullable=True, index=True)

    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # AI generated summary, stored once requested
    ai_summary = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class TicketEvent(Base):
    """Internal notes and activity history for a ticket."""

    __tablename__ = "ticket_events"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)

    # "note" (written by staff) or "event" (status change, assignment...)
    kind = Column(String, nullable=False, default="note")

    author = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=True)

    # "widget" (customer facing) or "console" (staff testing the agent)
    channel = Column(String, nullable=False, default="widget")

    # "ai" while the agent answers, "human" after a staff takeover
    mode = Column(String, nullable=False, default="ai")

    escalated = Column(Boolean, default=False)
    sentiment = Column(String, nullable=True, default="neutral")
    assigned_to = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    """A single message inside a chat session."""

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)

    # user, assistant (AI), agent (human staff)
    role = Column(String, nullable=False)

    # Stored after PII masking; raw customer data never reaches the database
    message = Column(Text, nullable=False)

    tools = Column(Text, nullable=True)
    sources = Column(Text, nullable=True)
    redactions = Column(Text, nullable=True)
    sentiment = Column(String, nullable=True)
    author = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("conversations.id"), unique=True)
    session_id = Column(String, index=True)

    # 1 = helpful, -1 = not helpful
    rating = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Records privacy-relevant staff actions."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AppSetting(Base):
    """Workspace settings edited from the Settings page (key/value)."""

    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
