"""
Email alerts for urgent tickets.

Emails contain only the ticket number, its title and a link to the
dashboard. Customer contact details and chat content are never emailed.
"""

import logging
import smtplib
import ssl
import threading

from email.message import EmailMessage

from app_settings import get_section
from config import PUBLIC_APP_URL


logger = logging.getLogger("supportpilot.notify")


class EmailError(Exception):
    pass


def _recipients(settings):
    return [
        address.strip()
        for address in (settings.get("recipients") or "").replace(";", ",").split(",")
        if "@" in address
    ]


def send_email(settings, subject, body, recipients=None):
    recipients = recipients or _recipients(settings)

    if not settings.get("smtp_host"):
        raise EmailError("Add your email server (SMTP host) first.")

    if not recipients:
        raise EmailError("Add at least one email address to send alerts to.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.get("from_address") or settings.get("smtp_user")
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    port = int(settings.get("smtp_port") or 587)

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(settings["smtp_host"], port, timeout=15, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(settings["smtp_host"], port, timeout=15)

            if settings.get("use_tls", True):
                server.starttls(context=ssl.create_default_context())

        with server:
            if settings.get("smtp_user"):
                server.login(settings["smtp_user"], settings.get("smtp_password", ""))

            server.send_message(message)

    except smtplib.SMTPAuthenticationError as error:
        raise EmailError("The email server rejected the username or password.") from error
    except (smtplib.SMTPException, OSError) as error:
        raise EmailError(f"Couldn't send the email: {error.__class__.__name__}: {error}") from error


def send_test_email(settings):
    send_email(
        settings,
        "SupportPilot test email",
        "Email alerts are working. You'll get an email like this whenever an urgent ticket is created.\n",
    )


def urgent_ticket_alert(ticket_id, title):
    """Fire-and-forget: never slows down or breaks ticket creation."""

    settings = get_section("email")

    if not settings.get("enabled"):
        return

    number = f"TKT-{ticket_id:04d}"
    body = (
        f"An urgent ticket needs your team's attention.\n\n"
        f"Ticket: {number}\n"
        f"Issue: {title}\n\n"
        f"Open it here: {PUBLIC_APP_URL.rstrip('/')}/tickets/{ticket_id}\n\n"
        f"Customer details are kept in SupportPilot and are not included in this email.\n"
    )

    def worker():
        try:
            send_email(settings, f"Urgent ticket {number}: {title[:80]}", body)
        except EmailError as error:
            logger.warning("Urgent ticket alert failed: %s", error)

    threading.Thread(target=worker, daemon=True).start()
