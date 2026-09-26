import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import (
    create_token,
    demo_logins_active,
    get_current_user,
    hash_password,
    is_active,
    require_admin,
    reset_demo_cache,
    user_to_dict,
    verify_password,
)
from database import get_db
from models import User
from utils import audit, iso


router = APIRouter(tags=["Auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLES = ("admin", "agent")


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):

    user = (
        db.query(User)
        .filter(User.email == request.email.strip().lower())
        .first()
    )

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not is_active(user):
        raise HTTPException(
            status_code=403,
            detail="This account has been removed. Ask your admin for access."
        )

    audit(db, user.email, "login")
    db.commit()

    return {
        "token": create_token(user),
        "user": user_to_dict(user)
    }


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {**user_to_dict(user), "demo_password": demo_logins_active()}


@router.get("/public/login-info")
def login_info():
    """The login page only offers demo accounts while they still work."""

    return {"demo_accounts": demo_logins_active()}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/auth/change-password")
def change_password(
    request: PasswordChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is not correct")

    if request.new_password == request.current_password:
        raise HTTPException(status_code=400, detail="Choose a password different from the current one")

    user.password_hash = hash_password(request.new_password)
    audit(db, user.email, "password_changed")
    db.commit()
    reset_demo_cache()

    return {"success": True}


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Active team members, for the ticket "Assigned to" list."""

    return [
        {"id": item.id, "name": item.name, "role": item.role}
        for item in db.query(User).order_by(User.name).all()
        if is_active(item)
    ]


# ---------------------------------------------------
# Team management (admin only)
# ---------------------------------------------------

def serialize_member(user):
    return {
        **user_to_dict(user),
        "active": is_active(user),
        "created_at": iso(user.created_at),
    }


def _active_admins(db):
    return [
        user for user in db.query(User).filter(User.role == "admin").all()
        if is_active(user)
    ]


@router.get("/team")
def list_team(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.id).all()
    return [serialize_member(user) for user in users]


class MemberCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=200)
    role: str = "agent"
    password: str = Field(min_length=8, max_length=128)


@router.post("/team")
def add_member(
    request: MemberCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    email = request.email.strip().lower()

    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    if request.role not in ROLES:
        raise HTTPException(status_code=400, detail="Role must be admin or agent")

    existing = db.query(User).filter(User.email == email).first()

    if existing and is_active(existing):
        raise HTTPException(status_code=400, detail="Someone with this email is already on the team")

    if existing:
        # Re-adding a removed member restores their account
        existing.name = request.name.strip()
        existing.role = request.role
        existing.password_hash = hash_password(request.password)
        existing.active = True
        user = existing
    else:
        user = User(
            name=request.name.strip(),
            email=email,
            role=request.role,
            password_hash=hash_password(request.password),
            active=True,
        )
        db.add(user)

    audit(db, admin.email, "team_member_added", target=email)
    db.commit()
    db.refresh(user)

    return serialize_member(user)


class MemberUpdate(BaseModel):
    role: str | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


@router.patch("/team/{user_id}")
def update_member(
    user_id: int,
    request: MemberUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(status_code=404, detail="Team member not found")

    losing_admin = (
        user.role == "admin"
        and is_active(user)
        and (request.active is False or (request.role is not None and request.role != "admin"))
    )

    if user.id == admin.id and (request.active is False or losing_admin):
        raise HTTPException(status_code=400, detail="You can't remove or demote your own account")

    if losing_admin and len(_active_admins(db)) <= 1:
        raise HTTPException(status_code=400, detail="The team needs at least one admin")

    if request.role is not None:
        if request.role not in ROLES:
            raise HTTPException(status_code=400, detail="Role must be admin or agent")
        user.role = request.role

    if request.active is not None:
        user.active = request.active

    if request.password:
        user.password_hash = hash_password(request.password)

    changes = [
        name for name, value in
        (("role", request.role), ("active", request.active), ("password", request.password))
        if value is not None
    ]

    audit(db, admin.email, "team_member_updated", target=user.email, detail=", ".join(changes))
    db.commit()
    reset_demo_cache()

    return serialize_member(user)
