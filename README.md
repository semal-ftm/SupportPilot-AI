# 🤖 SupportPilot AI

**Agentic, privacy-first customer support.** SupportPilot answers from your company documents, looks up and acts on real orders, escalates to humans when it matters, and masks personal data before any AI model sees it.

Built with React, FastAPI, Groq, FAISS and SQLite.

---

## ✨ Highlights

| | Feature | What it does |
|---|---|---|
| 🤖 | **Agentic AI with 6 tools** | Order lookup, help-document search, ticket creation, order cancellation, refund requests, ticket status |
| ⚡ | **Live answers** | Replies appear word by word; a small "What the AI did" link shows each step it took |
| 🛡️ | **Privacy Shield** | Emails, phones, card numbers, IBANs and ID numbers become placeholders like `[EMAIL_1]` before storage or AI |
| 📚 | **Help documents** | Upload PDF or text policies; the AI answers from them |
| 🎧 | **Take over any chat** | Read customer chats live and reply yourself with one click |
| 🎫 | **Simple tickets** | Open / In progress / Resolved tabs, team notes, and "Write a reply for me" |
| 💬 | **Website chat widget** | One `<script>` line adds a chat button to any website, in your company name and colour |
| 🛒 | **Shopify connection** | The AI looks up real orders from your Shopify store (read-only) |
| 🔔 | **Email alerts** | An email for every urgent ticket, with no customer details in it |
| 👥 | **Team accounts** | Add, remove and reset passwords for admins and agents |
| 🌓 | **Clean green design** | Plain-language pages, a getting-started checklist, light and dark mode, works on phones |

## 🗺️ The app at a glance

| Page | What it's for |
|---|---|
| **Home** | Getting-started checklist, four key numbers, chats per day, tickets that need attention |
| **Test Chat** | Try the AI exactly like a customer would |
| **Conversations** | Read every customer chat; take over and reply yourself |
| **Tickets** | Issues the AI passed to your team |
| **Orders** | Orders the AI can look up |
| **Help Docs** | Upload the documents the AI answers from |
| **Settings** | My account (change password), Team, Chat window (name, colour, website code), Store, Email alerts, Privacy |

## 🛡️ Privacy by design

```
Customer: "Cancel ORD-1006, my email is lina@example.com"
                │
                ▼
      Privacy Shield (on your server)
      "Cancel ORD-1006, my email is [EMAIL_1]"   ← stored & sent to the LLM
                │
                ▼
      LLM calls cancel_order(order="ORD-1006", email="[EMAIL_1]")
                │
                ▼
      Tool resolves [EMAIL_1] in memory → verifies ownership → cancels
```

- **Masking:** emails, phone numbers, Luhn-valid card numbers, IBANs and Saudi national ID / Iqama numbers.
- **Data minimisation:** the order tool never returns customer names or emails to the model; staff see masked contacts (`s****@example.com`) by default.
- **Audited access:** admins can reveal a customer's contact details, and every reveal is written to the audit log.
- **Retention:** conversations inactive for `RETENTION_DAYS` (default 30) are deleted automatically every 6 hours; admins can purge manually.
- **Right to erasure:** customers can delete their own conversation from the widget.
- **Document redaction:** personal data found in uploaded knowledge documents is permanently removed before indexing.
- **Identity checks:** cancelling or refunding an order requires the email address on the order.
- **Human in the loop:** refunds always create a ticket for human approval; AI drafts must be reviewed before sending.
- **Local sentiment analysis:** runs on the server with no external calls.

> These are technical safeguards, not legal advice. Before processing real customer data, review the configuration (retention, AI provider, data residency) with your compliance and legal teams against applicable regulations such as PDPL and SAMA requirements.

## 🧩 Architecture

```
  Customer widget ──┐                         ┌── Staff dashboard (React)
  (/widget, iframe) │                         │   Home · Test Chat · Conversations
                    ▼                         ▼   Tickets · Orders · Help Docs · Settings
              ┌────────────────── FastAPI ──────────────────┐
              │  Privacy Shield → Agent loop (Groq, stream) │
              │     │                 │                     │
              │  Sentiment      Tools: orders · RAG ·       │
              │  (local)        tickets · cancel · refund   │
              │                        │          │         │
              │                     SQLite      FAISS       │
              │  Auth (JWT, roles) · Audit log · Retention  │
              └─────────────────────────────────────────────┘
```

## 💻 Technology

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, TanStack Query, lucide-react, react-markdown, sonner |
| Backend | Python, FastAPI, SQLAlchemy, NDJSON streaming |
| AI | Groq API (`openai/gpt-oss-120b`), tool calling |
| RAG | FAISS, Sentence Transformers (`all-MiniLM-L6-v2`), pypdf |
| Auth | PBKDF2 password hashing, HS256 JWT (standard library only) |
| Database | SQLite (a single file) |

## 📁 Project structure

```
backend/
├── main.py            App setup, startup (migrations, seed, retention loop)
├── config.py          Environment settings
├── ai_service.py      Streaming agent loop, tool definitions, AI Copilot
├── privacy.py         PII detection, reversible masking vault, redaction
├── sentiment.py       Local sentiment detection
├── tools.py           Order, ticket, cancel and refund tools
├── store.py           Order sources: demo orders or Shopify
├── notify.py          Urgent-ticket email alerts
├── app_settings.py    Settings saved from the dashboard
├── rag.py             Document indexing, deletion, FAISS search
├── memory.py          Chat sessions and message storage
├── auth.py            Password hashing, JWT, role checks
├── seed.py            Synthetic demo data
├── models.py          SQLAlchemy models
└── routers/           auth & team · chat · sessions · tickets · orders · knowledge · analytics · privacy · settings

frontend/src/
├── pages/             Home, TestChat, Conversations, Tickets, Orders, HelpDocs, Settings, Widget, Login
├── components/        UI kit, layout, chat message, composer, badges
└── lib/               API client, streaming chat hook, auth, theme
frontend/public/widget.js   Embeddable website widget loader
```

## 🚀 Getting started

### 1. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1        # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env             # then set GROQ_API_KEY and JWT_SECRET
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000 · Swagger docs: http://127.0.0.1:8000/docs
- On first start the database is migrated, demo data is seeded, and the bundled policies are indexed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

| Demo account | Email | Password |
|---|---|---|
| Admin | `admin@supportpilot.dev` | `admin123` |
| Agent | `agent@supportpilot.dev` | `agent123` |

After signing in, change them in **Settings → My account**. Until both are changed, the dashboard shows a warning; afterwards the demo buttons disappear from the login page. Add real team members in **Settings → Team**.

The customer widget is at http://localhost:5173/widget. To embed it on a website:

```html
<script src="http://localhost:5173/widget.js" defer></script>
```

### 3. Connect your store, alerts and branding

Everything is in **Settings** (admin only), with step-by-step hints on each screen:

- **Store**: choose Shopify, enter your store address and access token, click **Test connection**, then **Save and connect**. SupportPilot only *reads* orders; cancel and refund requests become tickets that your team completes in the store admin.
- **Email alerts**: pick Gmail, Outlook or another provider, enter the sending address and password (for Gmail, an App Password), click **Send a test email**, then turn alerts on.
- **Chat window**: set your company name, colour and welcome message, then copy the website code.

## ✅ Before real customers use it

- Change both demo passwords, or remove those accounts in **Settings → Team**.
- Set `SEED_DEMO_DATA=false` on a fresh database so no demo orders or chats are created.
- Set `CORS_ORIGINS` to your dashboard address and `CORS_ORIGIN_REGEX=` (empty) so only your site can call the API.
- Back up `backend/supportpilot.db` regularly. It holds all chats, tickets and settings.
- Customer messages are stored in your database, and masked messages are sent to the AI provider (Groq). Check where both are located against your data-protection obligations (for example PDPL and SAMA requirements) with your compliance or legal team before real customer data is processed.

## 🧪 Things to try

| Try (in **Test Chat**) | What you'll see |
|---|---|
| `Where is order ORD-1001?` | The AI looks up the order |
| `Can I return a product after 20 days?` | Answer based on your help documents |
| `Please cancel ORD-1006, my email is lina@example.com` | The email is hidden from the AI, verified, and the order is cancelled |
| `I was charged twice for ORD-1002. This is unacceptable!` | An urgent ticket is created for your team |
| **Conversations** → **Take over** | Reply as a person; the customer sees it within seconds |
| **Tickets** → open one → **Write a reply for me** | A draft reply you can check and send |

## ⚙️ Configuration (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | – | Groq API key (required for AI features) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Model used by the agent |
| `JWT_SECRET` | random per start | Signs login tokens; set it so sessions survive restarts |
| `PII_MASKING` | `true` | Mask personal data before storage and AI |
| `REDACT_DOCUMENTS` | `true` | Redact personal data in uploaded documents |
| `RETENTION_DAYS` | `30` | Auto-delete inactive conversations after N days |
| `CORS_ORIGINS` | `http://localhost:5173,…` | Allowed frontend origins |
| `SEED_DEMO_DATA` | `true` | Seed synthetic demo history on first start |
| `DATABASE_URL` | `sqlite:///./supportpilot.db` | Database file |
| `PUBLIC_APP_URL` | `http://localhost:5173` | Dashboard address, used in alert email links |
| `DATA_DIR` / `UPLOAD_DIR` | `.` / `uploads` | Where the search index and uploaded documents are kept |

## 🔐 Security notes

- Keep real keys only in `backend/.env` (git-ignored). `backend/.env.example` documents the variables.
- Knowledge uploads and deletions, conversation deletion, purges, contact reveals, team changes and settings changes are **admin only** and audited.
- Store tokens and the email password are saved in the database and never sent back to the browser. Anyone with access to the database server can read them, so protect it and its backups.
- Removed team members are signed out immediately and can't sign in again.
- Public chat endpoints are rate limited per IP (20 messages/minute) and messages are capped at 2,000 characters.
- All demo customers and orders are synthetic (`example.com` addresses).

## 🔮 Roadmap ideas

Salla and Zid stores · PostgreSQL · Docker hosting · WhatsApp and email as customer channels · multi-tenant workspaces · SSO · WebSocket push instead of polling · evaluation suite for answer quality · encrypting stored store tokens
