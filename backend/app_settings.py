"""
Workspace settings stored in the database, so admins can change them from
the Settings page without editing files or restarting the server.

Secret values (store API tokens, SMTP password) are write-only: the API
never sends them back to the browser.
"""

import json

from database import SessionLocal
from models import AppSetting


DEFAULTS = {
    "branding": {
        "company_name": "Customer Support",
        "color": "#0f9d58",
        "welcome_message": (
            "Hi there! I can help you track an order, answer questions about "
            "our policies, or connect you with our team. How can I help?"
        ),
    },
    "store": {
        # demo or shopify
        "provider": "demo",
        "shop_domain": "",
        "api_token": "",
    },
    "email": {
        "enabled": False,
        "recipients": "",
        "smtp_host": "",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_password": "",
        "from_address": "",
        "use_tls": True,
    },
}

SECRET_FIELDS = {
    "store": ["api_token"],
    "email": ["smtp_password"],
}


def get_section(name):
    db = SessionLocal()

    try:
        row = db.get(AppSetting, name)
        stored = json.loads(row.value) if row and row.value else {}
    finally:
        db.close()

    return {**DEFAULTS[name], **stored}


def save_section(name, values):
    """Merge values into a section. Empty secret fields keep the old secret."""

    current = get_section(name)

    for key, value in values.items():
        if key not in DEFAULTS[name]:
            continue

        if key in SECRET_FIELDS.get(name, []) and not value:
            continue

        current[key] = value

    db = SessionLocal()

    try:
        row = db.get(AppSetting, name)

        if row:
            row.value = json.dumps(current)
        else:
            db.add(AppSetting(key=name, value=json.dumps(current)))

        db.commit()
    finally:
        db.close()

    return current


def public_view(name, values=None):
    """A section without its secrets, plus has_<secret> flags."""

    values = dict(values or get_section(name))

    for key in SECRET_FIELDS.get(name, []):
        values[f"has_{key}"] = bool(values.pop(key, ""))

    return values
