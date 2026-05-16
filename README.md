# CRMP by EmirCo

**Next-generation CRM for modern revenue teams.**

CRMP is a full-stack Customer Relationship Management platform with a React/Vite frontend and FastAPI backend. It combines pipeline management, unified communications, task automation, and AI-powered insights in one cohesive workspace.

## 🚀 Quick Start

### Frontend Only (Preview Mode)

The frontend can run standalone with demo data:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3225](http://127.0.0.1:3225)

### Full Stack (Backend + Frontend + AI)

**1. Start infrastructure:**
```bash
cd backend
docker compose up -d postgres redis
```

**2. Setup backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
```

**3. Start LM Studio** (for AI features):
- Open LM Studio
- Load `nvidia/nemotron-3-nano-4b` model
- Start local server on port 1234

**4. Start backend:**
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**5. Start frontend** (in new terminal):
```bash
npm run dev
```

## ✨ Features

### Core CRM
- **Pipeline Management** — Drag-and-drop Kanban board with 6 stages
- **Contact Directory** — Companies, contacts, enrichment
- **Task Queue** — Priorities, assignments, due dates
- **Unified Inbox** — Email, chat, WhatsApp conversations
- **Project Delivery** — Post-sale project tracking

### Analytics & Insights
- **Dashboard** — Revenue metrics, growth charts
- **Forecasting** — Commit, upside, risk scenarios
- **Analytics** — Pipeline breakdown, channel mix, rep performance
- **Campaigns** — Lifecycle outreach tracking

### AI Assistant (AgentP)
- **Smart Chat** — Context-aware CRM assistant
- **Deal Scoring** — Health assessment and recommendations
- **Email Drafting** — AI-powered reply suggestions
- **Contact Enrichment** — Auto-fill and segment suggestions
- **Task Prioritization** — Intelligent queue ordering

### Automation
- **Workflow Builder** — Visual automation designer
- **Trigger Rules** — Deal stage changes, task creation, email receipt
- **Actions** — Send email, create task, update deal, webhook
- **Service Desk** — SLA tracking and escalation

## 🛠 Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 6.4.1 | Build tool |
| Tailwind CSS | 4.1.12 | Styling |
| shadcn/ui | latest | Component library |
| React Router | 7.13.0 | Routing |
| motion | 12.23.24 | Animations |
| Recharts | 2.15.2 | Charts |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.115 | API framework |
| SQLAlchemy | 2.0 | ORM (async) |
| PostgreSQL | 16 | Database |
| Redis | 7 | Cache |
| Alembic | 1.13 | Migrations |
| python-jose | 3.3 | JWT auth |

## 📁 Project Structure

```
crmp/
├── src/                        # Frontend source
│   ├── app/
│   │   ├── components/         # UI components
│   │   │   ├── ui/             # shadcn/ui (48 components)
│   │   │   ├── crm-ui/         # Custom CRM components
│   │   │   └── pages/          # Page components (15 pages)
│   │   ├── lib/                # API client & utilities
│   │   ├── providers/          # React Context providers
│   │   └── hooks/              # Custom React hooks
│   ├── test/                   # Test suite (65 tests)
│   └── styles/                 # CSS & design tokens
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/                # API routes (18 routers)
│   │   ├── models/             # SQLAlchemy models (20+)
│   │   ├── services/           # Business logic
│   │   ├── ai/                 # AI modules
│   │   └── events/             # Event system
│   ├── alembic/                # Database migrations
│   └── scripts/                # Utility scripts
└── AGENTS.md                   # Detailed documentation for AI assistants
```

## 🧪 Testing

```bash
# Run all tests (65 passing)
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Type check
npm run typecheck
```

## 🎨 Design System

**2025 Vibrant Palette** (Apple-inspired):
- Primary: `#0071e3` (Electric Blue)
- Success: `#34c759` (Vibrant Green)
- Warning: `#ff9500` (Bright Orange)
- Accent: `#af52de` (Purple)
- Destructive: `#ff3b30` (Apple Red)

See `design-system/README.md` for full design tokens.

## 🔐 Security

- **httpOnly session cookies** — No localStorage tokens
- **Bcrypt password hashing**
- **CORS** configured for specific origins
- **Rate limiting** on AI endpoints
- **Local AI only** by default (no cloud providers)
- **Approval-gated AI actions**

## 🤖 AI Setup

The backend uses local AI via LM Studio:

1. Install [LM Studio](https://lmstudio.ai)
2. Download `nvidia/nemotron-3-nano-4b` model
3. Start local server on port 1234
4. Configure `backend/.env`:

```bash
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_MODEL=nvidia/nemotron-3-nano-4b
LOCAL_AI_ONLY=true
```

## 📚 Documentation

- `AGENTS.md` — Comprehensive guide for AI assistants
- `backend/README.md` — Backend setup & API docs
- `design-system/README.md` — Design tokens & components
- `MCP_README.md` — MCP integration guide

## 📝 License

Proprietary — EmirCo

---

**Built with ❤️ by EmirCo**
