"""
Order data sources.

"demo" uses the synthetic orders in the local database. Shopify reads
orders from the merchant's real store through its Admin API.

Every provider returns orders in the same shape:

    {order_number, product, amount, currency, status, carrier,
     tracking_number, expected_delivery, customer_name, customer_email,
     created_at}

Real stores are read-only: SupportPilot never cancels or refunds an order
in Shopify directly. Those requests become tickets so a
person approves them in the store's own admin.
"""

import logging
import re

import httpx

from app_settings import get_section
from database import SessionLocal
from models import Customer, Order
from utils import iso


logger = logging.getLogger("supportpilot.store")

TIMEOUT = httpx.Timeout(10.0)

PROVIDER_NAMES = {
    "demo": "Demo store",
    "shopify": "Shopify",
}


class StoreError(Exception):
    """A readable problem talking to the store (bad token, store offline...)."""


def _digits(order_number):
    return "".join(c for c in str(order_number or "") if c.isdigit())


def _dict(value):
    return value if isinstance(value, dict) else {}


def _list(value):
    return value if isinstance(value, list) else []


def _raise_for_status(response, provider, allow_missing=False):
    """False for a missing single record; StoreError for anything else."""

    if response.status_code in (401, 403):
        raise StoreError(f"{provider} rejected the access token. Check it in Settings → Store.")

    if response.status_code == 404:
        if allow_missing:
            return False

        raise StoreError(f"{provider} store not found. Check the store address.")

    if response.status_code >= 400:
        raise StoreError(f"{provider} returned an error ({response.status_code}).")

    return True


# ---------------------------------------------------
# Demo store (local database)
# ---------------------------------------------------

class DemoStore:
    key = "demo"
    read_only = False

    def _serialize(self, order, customer):
        return {
            "order_number": order.order_number,
            "product": order.product,
            "amount": order.amount,
            "currency": "USD",
            "status": order.status,
            "carrier": order.carrier,
            "tracking_number": order.tracking_number,
            "expected_delivery": order.expected_delivery,
            "customer_name": customer.name if customer else None,
            "customer_email": customer.email if customer else None,
            "customer_id": order.customer_id,
            "created_at": iso(order.created_at),
        }

    def get_order(self, order_number):
        db = SessionLocal()

        try:
            order = (
                db.query(Order)
                .filter(Order.order_number == str(order_number).strip().upper())
                .first()
            )

            if not order:
                return None

            return self._serialize(order, db.get(Customer, order.customer_id))
        finally:
            db.close()

    def list_orders(self, limit=50):
        db = SessionLocal()

        try:
            customers = {c.id: c for c in db.query(Customer).all()}
            orders = db.query(Order).order_by(Order.order_number.desc()).limit(limit).all()
            return [self._serialize(o, customers.get(o.customer_id)) for o in orders]
        finally:
            db.close()

    def test(self):
        return "Using the built-in demo orders."


# ---------------------------------------------------
# Shopify (Admin REST API)
# ---------------------------------------------------

class ShopifyStore:
    key = "shopify"
    read_only = True
    API_VERSION = "2024-10"

    def __init__(self, settings):
        domain = (settings.get("shop_domain") or "").strip().lower()
        domain = re.sub(r"^https?://", "", domain).strip("/")

        if domain and "." not in domain:
            domain = f"{domain}.myshopify.com"

        if not domain or not settings.get("api_token"):
            raise StoreError("Add your Shopify store address and access token in Settings → Store.")

        self.base = f"https://{domain}/admin/api/{self.API_VERSION}"
        self.headers = {"X-Shopify-Access-Token": settings["api_token"]}

    def _get(self, path, params=None, allow_missing=False):
        try:
            response = httpx.get(f"{self.base}{path}", headers=self.headers, params=params, timeout=TIMEOUT)
        except httpx.HTTPError as error:
            raise StoreError(f"Couldn't reach Shopify: {error.__class__.__name__}") from error

        if not _raise_for_status(response, "Shopify", allow_missing):
            return None

        return response.json()

    @staticmethod
    def _status(order):
        if order.get("cancelled_at"):
            return "Cancelled"

        if order.get("financial_status") in ("refunded", "partially_refunded"):
            return "Refunded"

        fulfillments = order.get("fulfillments") or []
        shipment = (fulfillments[-1].get("shipment_status") if fulfillments else None) or ""

        if shipment == "delivered":
            return "Delivered"

        if shipment == "out_for_delivery":
            return "Out for Delivery"

        if order.get("fulfillment_status") in ("fulfilled", "partial") or fulfillments:
            return "Shipped"

        return "Processing"

    def _serialize(self, order):
        fulfillments = _list(order.get("fulfillments"))
        last = _dict(fulfillments[-1]) if fulfillments else {}
        customer = _dict(order.get("customer"))
        name = " ".join(filter(None, [customer.get("first_name"), customer.get("last_name")]))

        return {
            "order_number": order.get("name") or f"#{order.get('order_number')}",
            "product": ", ".join(item.get("name", "") for item in order.get("line_items", [])) or "—",
            "amount": float(order.get("total_price") or 0),
            "currency": order.get("currency") or "USD",
            "status": self._status(order),
            "carrier": last.get("tracking_company"),
            "tracking_number": last.get("tracking_number"),
            "expected_delivery": None,
            "customer_name": name or None,
            "customer_email": order.get("email") or customer.get("email"),
            "customer_id": None,
            "created_at": order.get("created_at"),
        }

    def get_order(self, order_number):
        digits = _digits(order_number)

        if not digits:
            return None

        data = self._get("/orders.json", {"name": f"#{digits}", "status": "any", "limit": 1})
        orders = (data or {}).get("orders") or []

        return self._serialize(orders[0]) if orders else None

    def list_orders(self, limit=50):
        data = self._get("/orders.json", {"status": "any", "limit": min(limit, 250)})
        return [self._serialize(order) for order in (data or {}).get("orders", [])]

    def test(self):
        data = self._get("/shop.json")
        name = ((data or {}).get("shop") or {}).get("name", "your store")
        return f"Connected to {name} on Shopify."


PROVIDERS = {
    "demo": lambda settings: DemoStore(),
    "shopify": ShopifyStore,
}


def get_store(settings=None):
    settings = settings or get_section("store")
    factory = PROVIDERS.get(settings.get("provider"), PROVIDERS["demo"])
    return factory(settings)


def store_info():
    settings = get_section("store")
    provider = settings.get("provider", "demo")

    return {
        "provider": provider,
        "name": PROVIDER_NAMES.get(provider, provider),
        "read_only": provider != "demo",
    }
