"""
Privacy layer for SupportPilot.

Personal data typed by customers (emails, phone numbers, card numbers,
IBANs, national ID / Iqama numbers) is replaced with placeholders such as
[EMAIL_1] before the message is stored or sent to the LLM.

The mapping between placeholders and real values lives only in server
memory (the "vault") for the lifetime of the chat session. When the agent
calls a tool with a placeholder argument, the tool receives the real value,
so identity checks still work while the LLM provider never sees the data.
"""

import re
import threading

from collections import OrderedDict

from config import PII_MASKING


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b")

CARD_RE = re.compile(r"(?<![\w-])\d(?:[ -]?\d){12,18}(?![\w-])")

# Saudi national ID (starts with 1) and Iqama (starts with 2)
NATIONAL_ID_RE = re.compile(r"(?<![\w-])[12]\d{9}(?![\w-])")

PHONE_RE = re.compile(r"(?<![\w-])(?:\+|00)?\d(?:[ -]?\d){8,13}(?![\w-])")

DATE_RE = re.compile(r"^\d{4}[ -]\d{1,2}[ -]\d{1,2}$|^\d{1,2}[ -]\d{1,2}[ -]\d{4}$")

LABELS = {
    "EMAIL": "Email address",
    "IBAN": "Bank account (IBAN)",
    "CARD": "Payment card number",
    "NATIONAL_ID": "National ID / Iqama",
    "PHONE": "Phone number",
}


def _luhn_valid(number):
    digits = [int(d) for d in number if d.isdigit()]

    checksum = 0

    for position, digit in enumerate(reversed(digits)):
        if position % 2 == 1:
            digit *= 2

            if digit > 9:
                digit -= 9

        checksum += digit

    return checksum % 10 == 0


def _not_a_date(value):
    return not DATE_RE.match(value)


class Vault:
    def __init__(self):
        self.by_value = {}
        self.by_placeholder = {}
        self.counters = {}

    def placeholder_for(self, kind, value):
        key = (kind, value)

        if key in self.by_value:
            return self.by_value[key]

        self.counters[kind] = self.counters.get(kind, 0) + 1
        placeholder = f"[{kind}_{self.counters[kind]}]"

        self.by_value[key] = placeholder
        self.by_placeholder[placeholder] = value

        return placeholder


_vaults = OrderedDict()
_vault_lock = threading.Lock()
_MAX_VAULTS = 2000


def _get_vault(session_id):
    with _vault_lock:

        vault = _vaults.get(session_id)

        if vault is None:
            vault = Vault()
            _vaults[session_id] = vault

            # Drop the oldest sessions so memory stays bounded
            while len(_vaults) > _MAX_VAULTS:
                _vaults.popitem(last=False)
        else:
            _vaults.move_to_end(session_id)

        return vault


def forget_session(session_id):
    with _vault_lock:
        _vaults.pop(session_id, None)


def _apply(text, kind, pattern, replace, redactions, validate=None):
    def substitute(match):
        value = match.group(0)

        if validate and not validate(value):
            return value

        redactions.append({"type": kind, "label": LABELS[kind]})

        return replace(kind, value)

    return pattern.sub(substitute, text)


def _redact(text, replace):
    redactions = []

    text = _apply(text, "EMAIL", EMAIL_RE, replace, redactions)
    text = _apply(text, "IBAN", IBAN_RE, replace, redactions)
    text = _apply(text, "CARD", CARD_RE, replace, redactions, _luhn_valid)
    text = _apply(text, "NATIONAL_ID", NATIONAL_ID_RE, replace, redactions)
    text = _apply(text, "PHONE", PHONE_RE, replace, redactions, _not_a_date)

    return text, redactions


def mask_text(text, session_id):
    """Replace personal data with reversible, session-scoped placeholders."""

    if not PII_MASKING or not text:
        return text, []

    vault = _get_vault(session_id)

    return _redact(text, vault.placeholder_for)


def redact_permanently(text):
    """Irreversibly redact personal data, used for uploaded documents."""

    return _redact(text, lambda kind, value: f"[{kind} REDACTED]")


def unmask(value, session_id):
    """Resolve placeholders back to real values for tool execution."""

    if not PII_MASKING:
        return value

    vault = _get_vault(session_id)

    if isinstance(value, str):
        for placeholder, real in vault.by_placeholder.items():
            value = value.replace(placeholder, real)

        return value

    if isinstance(value, dict):
        return {key: unmask(item, session_id) for key, item in value.items()}

    if isinstance(value, list):
        return [unmask(item, session_id) for item in value]

    return value


def mask_email(email):
    """Display helper: ali@example.com -> a**@example.com"""

    if not email or "@" not in email:
        return email

    local, domain = email.split("@", 1)

    return f"{local[0]}{'*' * max(len(local) - 1, 2)}@{domain}"


def mask_name(name):
    """Display helper: Ali Khan -> Ali K."""

    if not name:
        return name

    parts = name.split()

    if len(parts) == 1:
        return parts[0]

    return f"{parts[0]} {parts[-1][0]}."
