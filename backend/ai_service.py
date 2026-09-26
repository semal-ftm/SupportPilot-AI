import json
import re
import time

from groq import Groq

from app_settings import get_section
from config import GROQ_API_KEY, GROQ_MODEL
from privacy import mask_text, unmask
from rag import search_knowledge_base
from tools import (
    cancel_order,
    check_ticket_status,
    create_support_ticket,
    get_order_details,
    request_refund,
)


# ---------------------------------------------------
# GROQ CLIENT
# ---------------------------------------------------

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def ai_available():
    return client is not None


def _require_client():
    if client is None:
        raise RuntimeError(
            "GROQ_API_KEY is not configured. Add it to backend/.env"
        )


# ---------------------------------------------------
# AGENT TOOLS
# ---------------------------------------------------

def _tool(name, description, properties, required):
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }
    }


ORDER_NUMBER = {
    "type": "string",
    "description": "Order number such as ORD-1001"
}

CUSTOMER_EMAIL = {
    "type": "string",
    "description": (
        "Email address the customer gave to confirm their identity. "
        "Pass placeholders such as [EMAIL_1] exactly as they appear."
    )
}

agent_tools = [
    _tool(
        "get_order_details",
        "Get real order information from the company database "
        "using an order number.",
        {"order_number": ORDER_NUMBER},
        ["order_number"]
    ),

    _tool(
        "search_knowledge_base",
        "Search company FAQs, return policies, refund policies, "
        "shipping rules, warranty information, and other "
        "company documents.",
        {
            "query": {
                "type": "string",
                "description": "The customer's question about company policies."
            }
        },
        ["query"]
    ),

    _tool(
        "create_support_ticket",
        "Create a support ticket for human review. "
        "Use this for payment disputes, duplicate charges, "
        "missing packages, serious complaints, or "
        "when the customer asks for human support.",
        {
            "title": {
                "type": "string",
                "description": "Short title for the support issue"
            },
            "description": {
                "type": "string",
                "description": "Summary of the customer's problem"
            },
            "priority": {
                "type": "string",
                "enum": ["Low", "Medium", "High"]
            },
            "category": {
                "type": "string",
                "enum": [
                    "Payment", "Delivery", "Refund",
                    "Product", "Account", "Other"
                ]
            },
            "order_number": {
                "type": "string",
                "description": "Related order number if one exists"
            }
        },
        ["title", "description", "priority", "category"]
    ),

    _tool(
        "cancel_order",
        "Cancel an order that has not shipped yet. Requires the "
        "customer's email address to confirm their identity.",
        {"order_number": ORDER_NUMBER, "customer_email": CUSTOMER_EMAIL},
        ["order_number", "customer_email"]
    ),

    _tool(
        "request_refund",
        "Submit a refund request for a delivered order. Creates a ticket "
        "for human approval. Requires the customer's email address.",
        {
            "order_number": ORDER_NUMBER,
            "customer_email": CUSTOMER_EMAIL,
            "reason": {
                "type": "string",
                "description": "Why the customer wants a refund"
            }
        },
        ["order_number", "customer_email", "reason"]
    ),

    _tool(
        "check_ticket_status",
        "Look up the current status of an existing support ticket.",
        {
            "ticket_number": {
                "type": "string",
                "description": "Ticket number such as TKT-0001"
            }
        },
        ["ticket_number"]
    ),
]


def system_prompt():
    """The base prompt plus the company name set in Settings → Chat window."""

    company = get_section("branding").get("company_name", "").strip()

    if not company or company == "Customer Support":
        return SYSTEM_PROMPT

    return SYSTEM_PROMPT + f"\nYou represent {company}. Refer to the business as {company}.\n"


SYSTEM_PROMPT = """
You are SupportPilot AI, an agentic customer support assistant.

You help customers with:
- orders
- shipping
- returns
- refunds
- warranties
- company policies
- support escalation

IMPORTANT RULES:

1. If the customer asks about a specific order,
   use get_order_details.

2. Never invent order information.

3. If an order number is required but missing,
   ask the customer for it.

4. For refund, return, shipping, warranty,
   FAQ, or company-policy questions,
   use search_knowledge_base.

5. Base policy answers only on retrieved
   company documents. If the documents do not
   cover the question, say so and offer a ticket.

6. Create a support ticket when an issue requires
   human review, including:
   - duplicate charges
   - payment disputes
   - package marked delivered but not received
   - serious unresolved complaints
   - customer explicitly asks for a human

7. Before creating a support ticket linked to an order,
   verify that the order exists.

8. When creating a ticket, tell the customer
   the ticket number.

9. cancel_order and request_refund change real data.
   Only call them when the customer clearly asks, and
   only after the customer has given the email address
   used on the order.

10. PRIVACY: personal data in customer messages is replaced
    with placeholders such as [EMAIL_1], [PHONE_1], [CARD_1],
    [IBAN_1] or [NATIONAL_ID_1]. Treat a placeholder as the
    value itself and pass it unchanged to tools. Never ask
    customers for card numbers, CVV, passwords, or one-time
    codes. If a customer shares card or bank details, tell
    them it was hidden for their protection and they should
    not share it in chat.

11. Reply in the same language the customer writes in
    (for example Arabic or English).

12. Keep responses friendly, professional,
    and concise. Use short paragraphs or bullet
    points and **bold** key facts like order status.
"""


# ---------------------------------------------------
# TOOL EXECUTION
# ---------------------------------------------------

def _summarize(name, result):
    if not result.get("success"):
        return result.get("message", "No result")

    if name == "get_order_details":
        return f"{result['order_number']} is {result['status']}"

    if name == "search_knowledge_base":
        files = sorted({item["filename"] for item in result["results"]})
        return f"{len(result['results'])} passages from {', '.join(files)}"

    if name in ("create_support_ticket", "request_refund"):
        return f"Created {result['ticket_number']}"

    if name == "cancel_order":
        if result.get("ticket_number"):
            return f"Sent to team as {result['ticket_number']}"
        return f"{result['order_number']} cancelled"

    if name == "check_ticket_status":
        return f"{result['ticket_number']} is {result['status']}"

    return "Done"


def execute_tool(name, arguments, session_id, sentiment):
    # The model only ever sees placeholders; tools get the real values
    args = unmask(arguments, session_id)

    if name == "get_order_details":
        return get_order_details(args.get("order_number", ""))

    if name == "search_knowledge_base":
        return search_knowledge_base(args.get("query", ""))

    if name == "create_support_ticket":
        return create_support_ticket(
            title=arguments.get("title", "Support request"),
            description=arguments.get("description", ""),
            priority=arguments.get("priority", "Medium"),
            order_number=args.get("order_number"),
            category=arguments.get("category", "Other"),
            session_id=session_id,
            sentiment=sentiment
        )

    if name == "cancel_order":
        return cancel_order(
            args.get("order_number", ""),
            args.get("customer_email"),
            session_id=session_id,
            sentiment=sentiment
        )

    if name == "request_refund":
        return request_refund(
            order_number=args.get("order_number", ""),
            # Stored on the ticket, so it keeps the masked version
            reason=arguments.get("reason", ""),
            customer_email=args.get("customer_email"),
            session_id=session_id,
            sentiment=sentiment
        )

    if name == "check_ticket_status":
        return check_ticket_status(args.get("ticket_number", ""), session_id)

    return {"success": False, "message": f"Unknown tool {name}"}


# ---------------------------------------------------
# MAIN SUPPORT AGENT
# ---------------------------------------------------

def run_agent(
    message: str,
    history=None,
    session_id: str = "console",
    sentiment: str = "neutral"
):
    """
    Run the agent loop and yield events as they happen:

      tool_start / tool_end  - each tool call with timing
      sources                - knowledge base passages used
      token                  - pieces of the streamed answer
      final                  - full answer, tools and sources
    """

    _require_client()

    messages = [{"role": "system", "content": system_prompt()}]

    if history:
        messages.extend(history)

    messages.append({"role": "user", "content": message})

    used_tools = []
    sources = []
    answer = ""

    # Allow the agent to make several decisions
    for _ in range(5):

        stream = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            tools=agent_tools,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=900,
            stream=True
        )

        content = ""
        tool_calls = {}

        for chunk in stream:

            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta

            if delta.content:

                # Separate text from an earlier turn in the same answer
                if not content and answer:
                    answer += "\n\n"
                    yield {"type": "token", "text": "\n\n"}

                content += delta.content
                answer += delta.content

                yield {"type": "token", "text": delta.content}

            for call in delta.tool_calls or []:

                slot = tool_calls.setdefault(
                    call.index,
                    {"id": "", "name": "", "arguments": ""}
                )

                if call.id:
                    slot["id"] = call.id

                if call.function and call.function.name:
                    slot["name"] = call.function.name

                if call.function and call.function.arguments:
                    slot["arguments"] += call.function.arguments

        # ---------------------------------------------------
        # NO MORE TOOLS NEEDED
        # ---------------------------------------------------

        if not tool_calls:
            break

        calls = [tool_calls[key] for key in sorted(tool_calls)]

        # Store AI tool-call message
        messages.append(
            {
                "role": "assistant",
                "content": content,
                "tool_calls": [
                    {
                        "id": call["id"],
                        "type": "function",
                        "function": {
                            "name": call["name"],
                            "arguments": call["arguments"] or "{}"
                        }
                    }
                    for call in calls
                ]
            }
        )

        # ---------------------------------------------------
        # EXECUTE REQUESTED TOOLS
        # ---------------------------------------------------

        for call in calls:

            name = call["name"]

            try:
                arguments = json.loads(call["arguments"] or "{}")
            except json.JSONDecodeError:
                arguments = {}

            yield {
                "type": "tool_start",
                "id": call["id"],
                "name": name,
                "args": arguments
            }

            started = time.perf_counter()

            try:
                result = execute_tool(name, arguments, session_id, sentiment)
            except Exception as error:
                result = {"success": False, "message": str(error)}

            elapsed = int((time.perf_counter() - started) * 1000)

            if name == "search_knowledge_base" and result.get("success"):
                for item in result["results"]:
                    source = {
                        "filename": item["filename"],
                        "text": item["text"][:320],
                        "score": item["score"]
                    }

                    if source not in sources:
                        sources.append(source)

                yield {"type": "sources", "sources": sources}

            summary = _summarize(name, result)

            record = {
                "id": call["id"],
                "name": name,
                "args": arguments,
                "ok": bool(result.get("success")),
                "summary": summary,
                "ms": elapsed
            }

            used_tools.append(record)

            yield {"type": "tool_end", **record}

            # Defensive: never pass raw personal data back to the model
            tool_content, _ = mask_text(
                json.dumps(result, default=str), session_id
            )

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": tool_content
                }
            )

    if not answer.strip():
        answer = (
            "I'm sorry, I couldn't complete that request. "
            "Could you rephrase it, or ask me to connect you with a human agent?"
        )
        yield {"type": "token", "text": answer}

    yield {
        "type": "final",
        "text": answer,
        "tools": used_tools,
        "sources": sources
    }


def generate_support_response(
    message: str,
    history=None,
    session_id: str = "console",
    sentiment: str = "neutral"
):
    """Non-streaming wrapper kept for the original /chat endpoint."""

    final = None

    for event in run_agent(message, history, session_id, sentiment):
        if event["type"] == "final":
            final = event

    return {
        "response": final["text"],
        "tool_used": final["tools"],
        "sources": final["sources"]
    }


# ---------------------------------------------------
# AGENT ASSIST FOR HUMAN STAFF
# ---------------------------------------------------

def generate_ticket_assist(ticket, transcript):
    """
    Summarize a ticket and draft a reply for a human agent to review.
    Input is already masked, so no personal data is sent.
    """

    _require_client()

    conversation = "\n".join(
        f"{item['role'].upper()}: {item['text']}"
        for item in transcript[-20:]
    ) or "(no conversation linked)"

    prompt = f"""
You are assisting a human customer support agent.

TICKET
Title: {ticket['title']}
Category: {ticket.get('category')}
Priority: {ticket['priority']}
Status: {ticket['status']}
Order: {ticket.get('order_number') or 'none'}
Description: {ticket['description']}

CONVERSATION
{conversation}

Return only a JSON object with these keys:
"summary": 2-3 sentence summary of the issue,
"customer_mood": one short phrase,
"next_steps": array of up to 3 short recommended actions,
"suggested_reply": a friendly, professional reply to the customer,
written in the customer's language, that does not promise anything
the agent has not verified.
"""

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=900
    )

    content = response.choices[0].message.content or ""

    match = re.search(r"\{.*\}", content, re.DOTALL)

    try:
        data = json.loads(match.group(0) if match else content)
    except json.JSONDecodeError:
        data = {"summary": content.strip()}

    return {
        "summary": data.get("summary", ""),
        "customer_mood": data.get("customer_mood", ""),
        "next_steps": data.get("next_steps", []) or [],
        "suggested_reply": data.get("suggested_reply", ""),
    }
