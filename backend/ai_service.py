import os
import json

from dotenv import load_dotenv
from groq import Groq

from tools import get_order_details, create_support_ticket
from rag import search_knowledge_base


# ---------------------------------------------------
# LOAD ENVIRONMENT VARIABLES
# ---------------------------------------------------

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise ValueError("GROQ_API_KEY not found in .env")


# ---------------------------------------------------
# GROQ CLIENT
# ---------------------------------------------------

client = Groq(api_key=api_key)


# ---------------------------------------------------
# AGENT TOOLS
# ---------------------------------------------------

agent_tools = [
    {
        "type": "function",
        "function": {
            "name": "get_order_details",
            "description": (
                "Get real order information from the company database "
                "using an order number."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "order_number": {
                        "type": "string",
                        "description": "Order number such as ORD-1001"
                    }
                },
                "required": ["order_number"]
            }
        }
    },

    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": (
                "Search company FAQs, return policies, refund policies, "
                "shipping rules, warranty information, and other "
                "company documents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "The customer's question about company policies."
                        )
                    }
                },
                "required": ["query"]
            }
        }
    },

    {
        "type": "function",
        "function": {
            "name": "create_support_ticket",
            "description": (
                "Create a human support ticket when the issue needs "
                "human review or cannot be safely resolved by the AI. "
                "Use this for payment disputes, duplicate charges, "
                "missing delivered packages, serious complaints, or "
                "when the customer asks for human support."
            ),
            "parameters": {
                "type": "object",
                "properties": {
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
                        "enum": [
                            "Low",
                            "Medium",
                            "High"
                        ]
                    },
                    "order_number": {
                        "type": "string",
                        "description": (
                            "Related order number if one exists"
                        )
                    }
                },
                "required": [
                    "title",
                    "description",
                    "priority"
                ]
            }
        }
    }
]


# ---------------------------------------------------
# MAIN SUPPORT AGENT
# ---------------------------------------------------

def generate_support_response(
    message: str,
    history=None
):

    messages = [
        {
            "role": "system",
            "content": """
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
   company documents.

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

9. Keep responses friendly, professional,
   and concise.
"""
                }
    ]

    if history:
        messages.extend(history)

    messages.append(
        {
            "role": "user",
            "content": message
        }
    )

    used_tools = []

    # Allow the agent to make several decisions
    for _ in range(4):

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            tools=agent_tools,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=500
        )

        ai_message = response.choices[0].message

        # ---------------------------------------------------
        # NO MORE TOOLS NEEDED
        # ---------------------------------------------------

        if not ai_message.tool_calls:

            return {
                "response": ai_message.content,
                "tool_used": used_tools
            }

        # Store AI tool-call message
        messages.append(
            ai_message.model_dump(exclude_none=True)
        )

        # ---------------------------------------------------
        # EXECUTE REQUESTED TOOLS
        # ---------------------------------------------------

        for tool_call in ai_message.tool_calls:

            function_name = tool_call.function.name

            arguments = json.loads(
                tool_call.function.arguments
            )

            # ===============================================
            # ORDER LOOKUP TOOL
            # ===============================================

            if function_name == "get_order_details":

                order_number = arguments["order_number"]

                tool_result = get_order_details(
                    order_number
                )

                tool_label = (
                    f"get_order_details({order_number})"
                )

                if tool_label not in used_tools:
                    used_tools.append(tool_label)

            # ===============================================
            # RAG KNOWLEDGE BASE TOOL
            # ===============================================

            elif function_name == "search_knowledge_base":

                query = arguments["query"]

                tool_result = search_knowledge_base(
                    query
                )

                if "search_knowledge_base" not in used_tools:
                    used_tools.append(
                        "search_knowledge_base"
                    )

            # ===============================================
            # SUPPORT TICKET TOOL
            # ===============================================

            elif function_name == "create_support_ticket":

                order_number = arguments.get(
                    "order_number"
                )

                # -------------------------------------------
                # VERIFY ORDER BEFORE CREATING TICKET
                # -------------------------------------------

                if order_number:

                    order_tool_label = (
                        f"get_order_details({order_number})"
                    )

                    already_checked = (
                        order_tool_label in used_tools
                    )

                    if not already_checked:

                        order_check = get_order_details(
                            order_number
                        )

                        used_tools.append(
                            order_tool_label
                        )

                        # Order does not exist
                        if not order_check.get("success"):

                            tool_result = {
                                "success": False,
                                "message": (
                                    f"Order {order_number} "
                                    "could not be verified. "
                                    "Support ticket was not created."
                                )
                            }

                            messages.append(
                                {
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "content": json.dumps(
                                        tool_result
                                    )
                                }
                            )

                            # Skip ticket creation
                            continue

                # -------------------------------------------
                # CREATE TICKET
                # -------------------------------------------

                tool_result = create_support_ticket(
                    title=arguments["title"],
                    description=arguments[
                        "description"
                    ],
                    priority=arguments[
                        "priority"
                    ],
                    order_number=order_number
                )

                if "create_support_ticket" not in used_tools:
                    used_tools.append(
                        "create_support_ticket"
                    )

            # ===============================================
            # UNKNOWN TOOL
            # ===============================================

            else:

                tool_result = {
                    "success": False,
                    "message": (
                        f"Unknown tool: {function_name}"
                    )
                }

            # ---------------------------------------------------
            # SEND TOOL RESULT BACK TO THE AI
            # ---------------------------------------------------

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(
                        tool_result
                    )
                }
            )

    # ---------------------------------------------------
    # FALLBACK IF AGENT EXCEEDS TOOL LOOP
    # ---------------------------------------------------

    return {
        "response": (
            "I couldn't complete the request automatically. "
            "Please contact human support."
        ),
        "tool_used": used_tools
    }