"""
Staff authentication: PBKDF2 password hashing and HS256 JWT tokens,
implemented with the standard library only.
"""

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    AGENT_EMAIL,
    AGENT_PASSWORD,
    JWT_SECRET,
    TOKEN_TTL_HOURS,
)
from database import SessionLocal, get_db
from models import User


PBKDF2_ITERATIONS = 240_000

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password):
    salt = os.urandom(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PBKDF2_ITERATIONS
    )

    return f"pbkdf2${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        _, iterations, salt, expected = stored.split("$")
    except ValueError:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
    )

    return hmac.compare_digest(digest.hex(), expected)


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(data):
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_token(user):
    header = {"alg": "HS256", "typ": "JWT"}

    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": int(time.time()) + TOKEN_TTL_HOURS * 3600,
    }

    signing_input = (
        f"{_b64(json.dumps(header).encode())}."
        f"{_b64(json.dumps(payload).encode())}"
    )

    signature = hmac.new(
        JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256
    ).digest()

    return f"{signing_input}.{_b64(signature)}"


def decode_token(token):
    try:
        header, payload, signature = token.split(".")
    except ValueError:
        return None

    expected = hmac.new(
        JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
    ).digest()

    try:
        if not hmac.compare_digest(_b64decode(signature), expected):
            return None

        data = json.loads(_b64decode(payload))
    except (ValueError, TypeError):
        return None

    if data.get("exp", 0) < time.time():
        return None

    return data


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise unauthorized

    data = decode_token(credentials.credentials)

    if not data:
        raise unauthorized

    user = db.query(User).filter(User.id == int(data["sub"])).first()

    if not user or not is_active(user):
        raise unauthorized

    return user


def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user


def is_active(user):
    return user.active is not False


def user_to_dict(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


# ---------------------------------------------------
# Demo password detection
# ---------------------------------------------------

_demo_cache = {"value": None}


def demo_logins_active():
    """
    True while a built-in account still uses the default password that is
    printed on the login page. Checking is slow on purpose (PBKDF2), so the
    answer is cached until a password changes.
    """

    if _demo_cache["value"] is None:
        db = SessionLocal()

        try:
            active = False

            for email, password in (
                (ADMIN_EMAIL, ADMIN_PASSWORD),
                (AGENT_EMAIL, AGENT_PASSWORD),
            ):
                user = db.query(User).filter(User.email == email).first()

                if (
                    user
                    and is_active(user)
                    and password in ("admin123", "agent123")
                    and verify_password(password, user.password_hash)
                ):
                    active = True

            _demo_cache["value"] = active
        finally:
            db.close()

    return _demo_cache["value"]


def reset_demo_cache():
    _demo_cache["value"] = None
