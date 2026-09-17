SupportPilot AI

SupportPilot AI is an Agentic AI customer support system built using React, FastAPI, Groq, RAG, FAISS, and SQLite.

Unlike a normal chatbot that only generates responses, SupportPilot can decide which tools to use, retrieve information from databases and company documents, remember conversations, and take actions such as creating support tickets.

Features

Agentic AI customer support

Groq LLM integration

Tool calling

RAG-based company knowledge search

PDF and TXT document upload

FAISS vector search

Sentence Transformer embeddings

Order lookup from SQLite

Automatic support ticket creation

Human escalation

Multi-tool execution

Conversation memory

Ticket priority management

Ticket status management

React dashboard

FastAPI backend

Swagger API testing

How It Works

The customer sends a question to SupportPilot.

Customer
   ↓
React Dashboard
   ↓
FastAPI Backend
   ↓
Groq AI Agent
   ↓
Decides which tool is required

The agent currently has three main tools:

Order Question
      ↓
get_order_details()
      ↓
SQLite Database

Policy Question
      ↓
search_knowledge_base()
      ↓
FAISS / RAG

Serious Customer Issue
      ↓
create_support_ticket()
      ↓
Human Escalation

Agent Tools

1. Order Lookup

get_order_details()

Retrieves order information from the SQLite database.

Example:

Where is order ORD-1001?

The AI checks the order database before answering.

2. RAG Knowledge Search

search_knowledge_base()

Searches uploaded company documents such as:

Refund policies

Shipping policies

Return policies

Warranty documents

FAQs

The AI uses the retrieved information instead of inventing company policies.

3. Support Ticket Creation

create_support_ticket()

Creates a support ticket when an issue requires human review.

Examples include:

Duplicate charges

Payment disputes

Missing delivered packages

Serious complaints

Requests for human support

What is RAG?

RAG stands for Retrieval-Augmented Generation.

SupportPilot uses RAG to search company documents before generating an answer.

PDF / TXT Document
        ↓
Text Extraction
        ↓
Text Chunks
        ↓
Embeddings
        ↓
FAISS Vector Search
        ↓
Relevant Information
        ↓
Groq LLM
        ↓
Customer Response

This allows the same SupportPilot system to work for different companies by changing the uploaded knowledge documents.

Conversation Memory

SupportPilot stores conversation history by session.

Example:

Customer:
Where is order ORD-1001?

AI:
Your order has been shipped.

Customer:
When should it arrive?

The AI understands that the customer is still talking about ORD-1001.

Ticket Management

Support tickets can move through three states:

Open
  ↓
In Progress
  ↓
Resolved

Ticket status changes are stored in the database.

Technology Stack

Frontend

React

Vite

JavaScript

Axios

CSS

Backend

Python

FastAPI

SQLAlchemy

SQLite

AI

Groq API

GPT-OSS model

Tool Calling

RAG

FAISS

Sentence Transformers

PyPDF

Vector Embeddings

Project Structure

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

Backend Setup

Go to the backend folder:

cd backend

Create a virtual environment:

python -m venv venv

Activate it on Windows:

.\venv\Scripts\Activate.ps1

Install Python dependencies:

pip install -r requirements.txt

Create a .env file inside the backend folder:

GROQ_API_KEY=your_groq_api_key_here

Run FastAPI:

uvicorn main:app --reload

Backend:

http://127.0.0.1:8000

Swagger:

http://127.0.0.1:8000/docs

Frontend Setup

Open another terminal and go to:

cd frontend

Install packages:

npm install

Run React:

npm run dev

Frontend:

http://localhost:5173

Example Questions

Order Lookup

Where is order ORD-1001?

RAG Search

Can I return a product after 20 days?

Shipping Policy

How long does standard shipping take?

Human Escalation

I was charged twice for order ORD-1002.
Please create a support ticket.

Conversation Memory

Where is order ORD-1003?

When should it arrive?

What order number was I talking about?

Sample Agent Flow

Customer
   ↓
"I was charged twice for ORD-1002"
   ↓
Groq Agent
   ↓
get_order_details(ORD-1002)
   ↓
Order Verified
   ↓
create_support_ticket()
   ↓
Ticket Stored in SQLite
   ↓
Human Escalation

Security

The real Groq API key is stored inside:

backend/.env

The .env file is excluded from GitHub using .gitignore.

Never upload your real API key to GitHub.

Use:

backend/.env.example

to show which environment variables are required.

Future Improvements

Real e-commerce API integration

Customer authentication

Email notifications

Live human-agent handoff

PostgreSQL

Multi-company support

Advanced analytics

Ticket assignment

Cloud deployment

Multiple specialized AI agents

Project Purpose

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

to create a practical customer support system.