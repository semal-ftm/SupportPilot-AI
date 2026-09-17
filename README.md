🤖 SupportPilot AI

Agentic AI customer support system with RAG, tool calling, conversation memory, order lookup, and automatic human escalation.

SupportPilot AI is a full-stack customer support application built with React, FastAPI, Groq, FAISS, and SQLite.
Unlike a normal chatbot, SupportPilot can decide which tool to use, retrieve real data, search company documents, remember a conversation, and take actions such as creating support tickets.

✨ Key Features

🤖 Agentic AI — decides which tool/action is required

🧠 Groq LLM integration — generates natural support responses

📚 RAG knowledge search — answers from uploaded company documents

🔎 FAISS vector search — retrieves relevant policy information

📄 PDF/TXT uploads — builds the support knowledge base

📦 Order lookup — retrieves real order data from SQLite

🎫 Automatic ticket creation — escalates complex issues to humans

🔄 Multi-tool execution — combines multiple actions in one request

💬 Conversation memory — remembers context within a support session

✅ Ticket workflow — Open → In Progress → Resolved

🖥️ Professional React dashboard

⚡ FastAPI backend and Swagger API docs

🧩 System Architecture

                        Customer
                           │
                           ▼
                    React Dashboard
                           │
                           ▼
                     FastAPI Backend
                           │
                           ▼
                      Groq AI Agent
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
       Order Lookup    RAG Search    Ticket Creation
             │             │             │
             ▼             ▼             ▼
           SQLite         FAISS      Human Escalation
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                 Conversation Memory
                           │
                           ▼
                    Final AI Response

🛠️ Agent Tools

Tool

Purpose

get_order_details()

Retrieves real order information from SQLite

search_knowledge_base()

Searches policies and FAQs using RAG + FAISS

create_support_ticket()

Creates a support ticket for human review

Example — Order Lookup

Customer:
Where is order ORD-1001?

Agent:
→ get_order_details(ORD-1001)
→ Reads order from SQLite
→ Returns the current status to the customer

Example — Human Escalation

Customer:
I was charged twice for order ORD-1002.

Agent:
→ Verifies ORD-1002
→ Detects a payment issue
→ Creates a high-priority support ticket
→ Returns the ticket number

📚 How RAG Works

RAG stands for Retrieval-Augmented Generation.

Instead of allowing the LLM to guess company rules, SupportPilot first searches the uploaded company documents and then generates an answer using the retrieved information.

PDF / TXT Document
        │
        ▼
   Text Extraction
        │
        ▼
     Chunking
        │
        ▼
    Embeddings
        │
        ▼
  FAISS Vector Index
        │
        ▼
Relevant Document Chunks
        │
        ▼
     Groq LLM
        │
        ▼
 Customer Response

Example:

Customer:
Can I return a product after 20 days?

Agent:
→ search_knowledge_base()
→ Finds the uploaded refund policy
→ Answers using the policy instead of guessing

💬 Conversation Memory

SupportPilot stores conversation history by session.

Customer:
Where is order ORD-1001?

AI:
Your order has been shipped.

Customer:
When should it arrive?

The agent understands that “it” refers to ORD-1001, so the customer does not need to repeat the order number.

🎫 Ticket Management

SupportPilot automatically creates support tickets for issues that require human review, such as:

Duplicate charges

Payment disputes

Missing delivered packages

Serious unresolved complaints

Explicit requests for a human agent

Ticket status can be managed from the dashboard:

Open
  ↓
In Progress
  ↓
Resolved

The selected status is saved in the SQLite database.

💻 Technology Stack

Layer

Technologies

Frontend

React, Vite, JavaScript, Axios, CSS

Backend

Python, FastAPI, SQLAlchemy

Database

SQLite

AI

Groq API, GPT-OSS model, Tool Calling

RAG

FAISS, Sentence Transformers, PyPDF

Testing

FastAPI Swagger UI

📁 Project Structure

SupportPilot-AI/
│
├── README.md
├── .gitignore
│
├── backend/
│   ├── main.py
│   ├── ai_service.py
│   ├── database.py
│   ├── models.py
│   ├── tools.py
│   ├── rag.py
│   ├── memory.py
│   ├── requirements.txt
│   ├── refund_policy.txt
│   ├── shipping_policy.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── index.css
    ├── package.json
    ├── package-lock.json
    └── vite.config.js

🚀 Getting Started

1. Clone the Repository

git clone https://github.com/YOUR_USERNAME/SupportPilot-AI.git
cd SupportPilot-AI

2. Start the Backend

cd backend
python -m venv venv

Activate the virtual environment on Windows:

.\venv\Scripts\Activate.ps1

Install dependencies:

pip install -r requirements.txt

Create a .env file inside backend/:

GROQ_API_KEY=your_groq_api_key_here

Start FastAPI:

uvicorn main:app --reload

Backend:

http://127.0.0.1:8000

Swagger API documentation:

http://127.0.0.1:8000/docs

3. Start the Frontend

Open another terminal:

cd frontend
npm install
npm run dev

Frontend:

http://localhost:5173

🧪 Example Test Questions

Order Lookup

Where is order ORD-1001?

RAG / Return Policy

Can I return a product after 20 days?

Shipping Policy

How long does standard shipping take?

Multi-Tool Escalation

I was charged twice for order ORD-1002.
Please create a support ticket.

Conversation Memory

Where is order ORD-1003?

When should it arrive?

What order number was I talking about?

🔐 Security

The real Groq API key must be stored only in:

backend/.env

The .env file is excluded through .gitignore and must never be committed to GitHub.

Use:

backend/.env.example

to show other developers which environment variables are required.

🔮 Future Improvements

Real e-commerce API integration

Customer authentication

Email notifications

Live human-agent handoff

PostgreSQL production database

Multi-company workspaces

Advanced analytics

Ticket assignment to support agents

Cloud deployment

Multiple specialized AI agents

🎯 Project Purpose

SupportPilot AI demonstrates how Agentic AI can combine:

LLM
+
RAG
+
Tool Calling
+
Database Access
+
Conversation Memory
+
Autonomous Actions

to build a practical customer support system instead of a simple question-answer chatbot.

👨‍💻 Author

Built as an Agentic AI project to demonstrate practical use of RAG, AI tool calling, autonomous actions, memory, and customer support automation.