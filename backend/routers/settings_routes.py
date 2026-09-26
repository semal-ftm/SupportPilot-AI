import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app_settings import SECRET_FIELDS, get_section, public_view, save_section
from auth import require_admin
from database import SessionLocal
from models import User
from notify import EmailError, send_test_email
from store import PROVIDERS, StoreError, get_store
from utils import audit


router = APIRouter(tags=["Settings"])

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _audit(admin, action, detail=None):
    db = SessionLocal()

    try:
        audit(db, admin.email, action, detail=detail)
        db.commit()
    finally:
        db.close()


@router.get("/public/branding")
def public_branding():
    """What the customer chat window looks like. No secrets here."""

    return get_section("branding")


@router.get("/settings")
def read_settings(admin: User = Depends(require_admin)):
    return {
        "branding": get_section("branding"),
        "store": public_view("store"),
        "email": public_view("email"),
    }


# ---------------------------------------------------
# Chat window look
# ---------------------------------------------------

class BrandingUpdate(BaseModel):
    company_name: str = Field(min_length=1, max_length=60)
    color: str
    welcome_message: str = Field(min_length=1, max_length=400)


@router.put("/settings/branding")
def update_branding(request: BrandingUpdate, admin: User = Depends(require_admin)):
    if not COLOR_RE.match(request.color):
        raise HTTPException(status_code=400, detail="Colour must look like #0f9d58")

    saved = save_section("branding", {
        "company_name": request.company_name.strip(),
        "color": request.color.lower(),
        "welcome_message": request.welcome_message.strip(),
    })
    _audit(admin, "settings_changed", "chat window")

    return saved


# ---------------------------------------------------
# Store connection
# ---------------------------------------------------

class StoreUpdate(BaseModel):
    provider: str
    shop_domain: str = Field(default="", max_length=200)
    # Empty means "keep the token that is already saved"
    api_token: str = Field(default="", max_length=500)


def _store_values(request):
    if request.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown store type")

    return {
        "provider": request.provider,
        "shop_domain": request.shop_domain.strip(),
        "api_token": request.api_token.strip(),
    }


def _merged(section, values):
    """Saved settings with the form's values on top (secrets kept if blank)."""

    merged = get_section(section)

    for key, value in values.items():
        if key in SECRET_FIELDS.get(section, []) and not value:
            continue

        merged[key] = value

    return merged


@router.post("/settings/store/test")
def test_store(request: StoreUpdate, admin: User = Depends(require_admin)):
    settings = _merged("store", _store_values(request))

    try:
        store = get_store(settings)
        message = store.test()
        sample = store.list_orders(limit=5)
    except StoreError as error:
        return {"success": False, "message": str(error)}

    return {"success": True, "message": message, "orders_found": len(sample)}


@router.put("/settings/store")
def update_store(request: StoreUpdate, admin: User = Depends(require_admin)):
    values = _store_values(request)

    if values["provider"] != "demo":
        try:
            get_store(_merged("store", values)).test()
        except StoreError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    saved = save_section("store", values)
    _audit(admin, "settings_changed", f"store: {values['provider']}")

    return public_view("store", saved)


# ---------------------------------------------------
# Email alerts
# ---------------------------------------------------

class EmailUpdate(BaseModel):
    enabled: bool = False
    recipients: str = Field(default="", max_length=1000)
    smtp_host: str = Field(default="", max_length=200)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_user: str = Field(default="", max_length=200)
    smtp_password: str = Field(default="", max_length=500)
    from_address: str = Field(default="", max_length=200)
    use_tls: bool = True


def _email_values(request):
    values = request.model_dump()

    for key in ("recipients", "smtp_host", "smtp_user", "smtp_password", "from_address"):
        values[key] = values[key].strip()

    return values


@router.post("/settings/email/test")
def test_email(request: EmailUpdate, admin: User = Depends(require_admin)):
    settings = _merged("email", _email_values(request))

    try:
        send_test_email(settings)
    except EmailError as error:
        return {"success": False, "message": str(error)}

    return {"success": True, "message": "Test email sent. Check your inbox (and spam folder)."}


@router.put("/settings/email")
def update_email(request: EmailUpdate, admin: User = Depends(require_admin)):
    values = _email_values(request)

    if values["enabled"] and not (values["smtp_host"] and values["recipients"]):
        raise HTTPException(status_code=400, detail="Add an email server and at least one recipient before turning alerts on")

    saved = save_section("email", values)
    _audit(admin, "settings_changed", "email alerts")

    return public_view("email", saved)
