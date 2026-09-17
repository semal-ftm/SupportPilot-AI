from database import SessionLocal
from models import Conversation


def save_message(
    session_id: str,
    role: str,
    message: str
):
    db = SessionLocal()

    try:
        conversation = Conversation(
            session_id=session_id,
            role=role,
            message=message
        )

        db.add(conversation)
        db.commit()

    finally:
        db.close()


def get_conversation_history(
    session_id: str,
    limit: int = 10
):
    db = SessionLocal()

    try:
        messages = (
            db.query(Conversation)
            .filter(
                Conversation.session_id == session_id
            )
            .order_by(
                Conversation.id.desc()
            )
            .limit(limit)
            .all()
        )

        messages.reverse()

        return [
            {
                "role": item.role,
                "content": item.message
            }
            for item in messages
        ]

    finally:
        db.close()