# CRMP by EmirCo — Agent Guide

> **Purpose:** This document gives AI assistants (Kimi, Claude, GPT, etc.) everything they need to work effectively on the CRMP codebase. It is the single source of truth for project context, conventions, and development workflows.

---

## 1. Project Overview

**CRMP by EmirCo** is a full-stack CRM (Customer Relationship Management) platform designed for modern revenue teams. It combines pipeline management, unified communications, task automation, and AI-powered insights in one cohesive workspace.

### Key Facts

| Attribute | Value |
|-----------|-------|
| **Product Name** | CRMP by EmirCo |
| **Tagline** | Pipeline Intelligence |
| **Frontend** | React 18 + TypeScript + Vite 6 |
| **Backend** | FastAPI + Python 3.11 + async SQLAlchemy |
| **Database** | PostgreSQL 16 + Redis 7 |
| **AI Engine** | Local LM Studio (NVIDIA Nemotron-3-Nano-4B) |
| **Styling** | Tailwind CSS 4.1.12 + shadcn/ui |
| **Testing** | Vitest + React Testing Library (65 tests) |
| **Package Manager** | npm |
| **Node Version** | v24.3.0 |
| **Python Version** | 3.11.15 |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React 18 + Vite 6 + Tailwind 4 + shadcn/ui                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Dashboard  │  │   Pipeline  │  │   AgentP (AI)       │ │
│  │  (Home)     │  │   (Kanban)  │  │   Chat Assistant    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Clients   │  │    Tasks    │  │   Analytics         │ │
│  │  (Contacts) │  │  (Queue)    │  │   (Reports)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Inbox     │  │  Campaigns  │  │   Settings          │ │
│  │  (Email)    │  │  (Outreach) │  │   (Config)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/REST + Cookie Auth
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  FastAPI + Async SQLAlchemy + PostgreSQL + Redis            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Auth API   │  │  CRM API    │  │  AI Services        │ │
│  │  (Session)  │  │  (CRUD)     │  │  (Nemotron/Local)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Events     │  │ Automation  │  │  Email Sync         │ │
│  │  (Dispatch) │  │  (Rules)    │  │  (Gmail/Outlook)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 18.3.1 | UI library |
| Language | TypeScript | 5.x | Type safety |
| Build Tool | Vite | 6.4.1 | Bundler & dev server |
| Router | React Router | 7.13.0 | Client-side routing |
| Styling | Tailwind CSS | 4.1.12 | Utility-first CSS |
| Animation | motion (Framer Motion) | 12.23.24 | Animations |
| Icons | Lucide React | 0.487.0 | Icon library |
| Charts | Recharts | 2.15.2 | Data visualization |
| Forms | React Hook Form | 7.55.0 | Form management |
| Toast | Sonner | 2.0.3 | Notifications |
| DnD | @dnd-kit | 6.3.1 | Drag and drop |
| Date | date-fns | 3.6.0 | Date formatting |

### 2.2 Directory Structure

```
src/
├── app/
│   ├── App.tsx                 # Root app component
│   ├── routes.ts               # React Router configuration
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components (48 files)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   └── ... (43 more)
│   │   ├── crm-ui/             # Custom CRM components
│   │   │   ├── metric-card.tsx
│   │   │   ├── page-header.tsx
│   │   │   ├── page-toolbar.tsx
│   │   │   ├── smart-action-button.tsx
│   │   │   ├── status-badge.tsx
│   │   │   └── surface-card.tsx
│   │   ├── pages/              # Page components (15 pages)
│   │   │   ├── Dashboard.tsx
│   │   │   ├── PipelinePage.tsx
│   │   │   ├── ClientsPage.tsx
│   │   │   ├── TasksPage.tsx
│   │   │   ├── MessagesPage.tsx
│   │   │   ├── EmailInboxPage.tsx
│   │   │   ├── ProjectsPage.tsx
│   │   │   ├── CampaignsPage.tsx
│   │   │   ├── ForecastPage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── AutomationsPage.tsx
│   │   │   ├── ServicePage.tsx
│   │   │   ├── AgentPPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── AuthPage.tsx
│   │   │   ├── AccountsPage.tsx
│   │   │   └── NotFoundPage.tsx
│   │   ├── animations/         # Animation components
│   │   │   └── page-transition.tsx
│   │   ├── email/              # Email components
│   │   │   ├── EmailList.tsx
│   │   │   └── EmailSettingsSection.tsx
│   │   ├── Brand.tsx           # Logo & brand components
│   │   ├── Layout.tsx          # Main layout (sidebar + topbar)
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── TopBar.tsx          # Top navigation bar
│   │   ├── Dashboard.tsx       # Dashboard page content
│   │   ├── Timeline.tsx        # Activity timeline
│   │   ├── AutomationBuilder.tsx # Workflow builder
│   │   ├── AgentPPanel.tsx     # Floating AgentP chat
│   │   ├── AppRouteErrorBoundary.tsx # Error handling
│   │   ├── route-gates.tsx     # Auth route guards
│   │   └── shell-nav.ts        # Navigation configuration
│   ├── lib/
│   │   ├── crm-api.ts          # API client (49 functions)
│   │   ├── crm-format.ts       # Formatting utilities
│   │   ├── crm-admin.ts        # Admin types
│   │   ├── fallback-data.ts    # Mock/preview data
│   │   ├── local-task-store.ts # Local task persistence
│   │   └── assistant-hooks.ts  # Assistant integration hooks
│   ├── providers/
│   │   ├── CrmProvider.tsx     # CRM state management
│   │   └── ThemeProvider.tsx   # Dark/light mode
│   └── hooks/
│       ├── use-debounce.ts
│       ├── use-local-storage.ts
│       └── use-online-status.ts
├── test/                       # Test suite (65 tests)
│   ├── setup.ts
│   ├── smoke.test.tsx
│   ├── components/
│   │   ├── Brand.test.tsx
│   │   ├── crm-ui.test.tsx
│   │   └── animations.test.tsx
│   ├── hooks/
│   │   ├── use-debounce.test.ts
│   │   ├── use-local-storage.test.ts
│   │   └── use-online-status.test.ts
│   └── utils/
│       └── test-utils.tsx
└── styles/
    ├── index.css               # Main stylesheet imports
    ├── theme.css               # Design system tokens
    ├── tailwind.css            # Tailwind directives
    └── fonts.css               # Font imports
```

### 2.3 Routing

All routes are lazy-loaded for code splitting:

```typescript
// src/app/routes.ts
const routes = [
  { path: "/", component: Dashboard },
  { path: "/clients", component: ClientsPage },
  { path: "/pipeline", component: PipelinePage },
  { path: "/projects", component: ProjectsPage },
  { path: "/messages", component: MessagesPage },
  { path: "/inbox", component: EmailInboxPage },
  { path: "/tasks", component: TasksPage },
  { path: "/automations", component: AutomationsPage },
  { path: "/campaigns", component: CampaignsPage },
  { path: "/forecast", component: ForecastPage },
  { path: "/analytics", component: AnalyticsPage },
  { path: "/service", component: ServicePage },
  { path: "/agentp", component: AgentPPage },
  { path: "/settings", component: SettingsPage },
  { path: "/auth", component: AuthPage },
  { path: "*", component: NotFoundPage },
];
```

### 2.4 State Management

**React Context** is used for global state:

- **CrmProvider** — Authentication, workspace data, connection status
- **ThemeProvider** — Dark/light mode preference

No Redux/Zustand — the app uses React's built-in state management with careful prop drilling avoidance through composition.

### 2.5 API Layer

The `crm-api.ts` file contains 49 typed API functions:

**Auth:** `loginToCrm`, `registerToCrm`, `logoutFromCrm`, `restoreCrmSession`
**Workspace:** `fetchCurrentWorkspace`, `bootstrapCurrentWorkspace`
**Dashboard:** `fetchDashboardOverview`, `fetchGrowthSeries`, `fetchPipelineBreakdown`
**CRM:** `fetchCompanies`, `fetchContacts`, `fetchDeals`, `fetchProjects`, `fetchTasks`, `fetchMessages`
**Email:** `fetchEmailAccounts`, `connectGmailAccount`, `syncEmails`, `fetchEmailMessages`
**Automation:** `fetchAutomationRules`, `createAutomationRule`

All requests include:
- Cookie-based authentication
- `X-Client-Trace-Id` header for tracing
- Automatic error handling with `CrmApiError`

### 2.6 Design System

**2025 Vibrant Palette** (Apple-inspired):

```css
:root {
  --primary: #0071e3;        /* Electric Blue */
  --success: #34c759;        /* Vibrant Green */
  --warning: #ff9500;        /* Bright Orange */
  --accent: #af52de;         /* Purple */
  --destructive: #ff3b30;    /* Apple Red */
  --info: #0071e3;           /* Info Blue */
}
```

**Key Design Tokens:**
- Border radius: `1rem` (16px) default
- Shadows: Glass morphism with glow effects
- Transitions: `200ms` standard, `300ms` for modals
- Typography: System UI stack, 15px base

---

## 3. Backend Architecture

### 3.1 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | FastAPI | 0.115 | API framework |
| ORM | SQLAlchemy | 2.0 | Database ORM (async) |
| Database | PostgreSQL | 16 | Primary database |
| Cache | Redis | 7 | Caching & sessions |
| Migrations | Alembic | 1.13 | Schema migrations |
| Auth | python-jose | 3.3 | JWT tokens |
| Passwords | passlib | 1.7 | Bcrypt hashing |
| HTTP Client | httpx | 0.27 | Async HTTP |
| Scheduler | APScheduler | 3.10 | Background tasks |
| Telemetry | OpenTelemetry | 1.27 | Observability |

### 3.2 Directory Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI application factory
│   ├── api/
│   │   ├── router.py           # API router aggregator
│   │   ├── dependencies.py     # FastAPI dependencies
│   │   ├── routes_auth.py
│   │   ├── routes_companies.py
│   │   ├── routes_contacts.py
│   │   ├── routes_deals.py
│   │   ├── routes_tasks.py
│   │   ├── routes_projects.py
│   │   ├── routes_messages.py
│   │   ├── routes_email.py
│   │   ├── routes_analytics.py
│   │   ├── routes_automation.py
│   │   ├── routes_ai.py
│   │   ├── routes_nemotron.py
│   │   ├── routes_multi_agent.py
│   │   ├── routes_swarm.py
│   │   └── ... (more)
│   ├── core/
│   │   ├── config.py           # Pydantic settings
│   │   ├── logging.py
│   │   └── telemetry.py
│   ├── db/
│   │   └── session.py          # Async session management
│   ├── models/                 # SQLAlchemy models (20+)
│   │   ├── user.py
│   │   ├── organization.py
│   │   ├── company.py
│   │   ├── contact.py
│   │   ├── deal.py
│   │   ├── task.py
│   │   ├── project.py
│   │   ├── message.py
│   │   ├── email_account.py
│   │   ├── automation_rule.py
│   │   ├── ai_chat_message.py
│   │   ├── ai_agent_run.py
│   │   └── ... (more)
│   ├── schemas/                # Pydantic schemas
│   │   └── ai.py               # AI-related schemas
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py
│   │   ├── ai_service.py
│   │   ├── nematron_service.py
│   │   ├── multi_agent_service.py
│   │   └── ... (more)
│   ├── ai/                     # AI modules
│   │   ├── llm_client.py       # LLM HTTP client
│   │   ├── nemotron_config.py
│   │   ├── nemotron_prompts.py
│   │   ├── prompt_templates.py
│   │   ├── classification.py
│   │   ├── deal_scoring.py
│   │   ├── reply_generation.py
│   │   ├── recommendations.py
│   │   ├── agent_framework.py
│   │   ├── agent_orchestrator.py
│   │   ├── swarm_core.py
│   │   └── swarm_orchestrator.py
│   └── events/                 # Event system
│       ├── dispatcher.py
│       ├── event_types.py
│       ├── repository.py
│       └── subscribers.py
├── alembic/                    # Database migrations
│   └── versions/
│       ├── e6c2c2515809_initial_schema.py
│       └── ... (7 more)
├── scripts/
│   ├── run_private_ai_evals.py
│   ├── export_private_backup.sh
│   └── restore_private_backup.sh
├── docker-compose.yml          # Postgres + Redis
├── pyproject.toml
├── alembic.ini
└── .env.example
```

### 3.3 Database Models (20 Entities)

| Model | Purpose |
|-------|---------|
| `User` | Authentication & profiles |
| `Organization` | Workspace/tenant isolation |
| `OrganizationAPIKey` | Server-side API keys |
| `Company` | B2B accounts |
| `Contact` | People/leads |
| `Deal` | Sales opportunities |
| `Project` | Post-sale delivery |
| `Task` | Action items |
| `Message` | Communications |
| `EmailAccount` | Connected email accounts |
| `EmailMessage` | Synced emails |
| `AutomationRule` | Workflow triggers |
| `AutomationRuleRun` | Rule executions |
| `Event` | Audit trail |
| `Note` | Entity annotations |
| `AIChatMessage` | AI conversation history |
| `AIAgentRun` | Agent execution logs |
| `AIActionProposal` | Suggested AI actions |
| `AIActionExecution` | Approved AI actions |
| `AIEvalRun` / `AIEvalSample` | AI evaluation data |

### 3.4 AI Services

The backend has multiple AI service layers:

1. **AIService** — Core AI (classification, reply generation, deal scoring)
2. **NematronCRMService** — NVIDIA Nemotron-3-Nano-4B integration
3. **GroundedInboxService** — Context-aware inbox copilot
4. **ProjectIntelligenceService** — Codebase-aware project assistant
5. **MultiAgentService** — Multi-agent orchestration (stub)
6. **AIAgentService** — Agent run management

All AI calls go through `LLMClient` which supports:
- Local LM Studio (default)
- OpenAI-compatible endpoints
- Automatic fallback on errors

### 3.5 Event System

Events are dispatched for all major actions:

```python
EventTypes.CONTACT_CREATED
EventTypes.DEAL_CREATED
EventTypes.DEAL_STAGE_CHANGED
EventTypes.PROJECT_CREATED
EventTypes.MESSAGE_RECEIVED
EventTypes.TASK_CREATED
EventTypes.AI_INSIGHT_CREATED
EventTypes.DEAL_SCORED
EventTypes.AUTOMATION_RULE_EXECUTED
```

Events are persisted to PostgreSQL first, with optional Redis/Kafka publishing.

---

## 4. Development Workflow

### 4.1 Frontend Commands

```bash
# Install dependencies
npm install

# Start dev server (port 3225)
npm run dev

# Run tests (65 tests)
npm run test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Production build
npm run build
```

### 4.2 Backend Commands

```bash
cd backend

# Setup environment
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"

# Start infrastructure
docker compose up -d postgres redis

# Run migrations
alembic upgrade head

# Start API (port 8000)
uvicorn app.main:app --reload

# Run evals
python scripts/run_private_ai_evals.py
```

### 4.3 Environment Variables

**Frontend (`.env` or Vite env):**
```bash
VITE_CRMP_API_URL=http://127.0.0.1:8000/api/v1
VITE_CRMP_AUTO_BOOTSTRAP=true
```

**Backend (`.env`):**
```bash
DATABASE_URL=postgresql+asyncpg://crmp:crmp@127.0.0.1:5432/crmp
REDIS_URL=redis://127.0.0.1:6379/0
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_MODEL=nvidia/nemotron-3-nano-4b
LOCAL_AI_ONLY=true
SECRET_KEY=your-secret-key
```

---

## 5. Coding Conventions

### 5.1 TypeScript/React

- **Strict mode enabled** — no implicit any
- **Functional components** with hooks
- **Named exports** for components
- **Props interfaces** defined inline or above component
- **Lucide icons** only (no mixed icon libraries)
- **Tailwind classes** using design tokens (no hardcoded values)

Example component pattern:
```tsx
import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

interface MyComponentProps {
  title: string;
  variant?: "default" | "accent";
}

export function MyComponent({ title, variant = "default" }: MyComponentProps) {
  const [active, setActive] = useState(false);
  
  return (
    <div className={cn(
      "rounded-xl border p-4",
      variant === "accent" && "border-primary/20 bg-primary-soft"
    )}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button onClick={() => setActive(!active)}>Toggle</Button>
    </div>
  );
}
```

### 5.2 Python/FastAPI

- **Type hints** everywhere
- **Async/await** for all I/O
- **Pydantic models** for request/response validation
- **Dependency injection** via FastAPI `Depends`
- **SQLAlchemy 2.0** style (new declarative mapping)

Example route pattern:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.deal import DealCreate, DealRead
from app.services.deal_service import DealService

router = APIRouter(prefix="/deals", tags=["deals"])

@router.post("", response_model=DealRead)
async def create_deal(
    payload: DealCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> DealRead:
    return await DealService(session).create_deal(
        organization_id=current_user.organization_id,
        payload=payload,
    )
```

### 5.3 File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase.tsx | `MetricCard.tsx` |
| Hooks | camelCase.ts | `useDebounce.ts` |
| Utilities | camelCase.ts | `crmFormat.ts` |
| Styles | kebab-case.css | `theme.css` |
| Tests | *.test.tsx/ts | `Brand.test.tsx` |
| API routes | routes_*.py | `routes_deals.py` |
| Models | snake_case.py | `deal.py` |
| Services | *_service.py | `deal_service.py` |

---

## 6. Testing Strategy

### 6.1 Frontend Tests (65 passing)

| Suite | Tests | Coverage |
|-------|-------|----------|
| Brand Components | 13 | Logo, lockup, text, animated |
| CRM UI Components | 24 | MetricCard, StatusBadge, SurfaceCard, PageHeader |
| Animation Components | 15 | PageTransition, Stagger, HoverScale, FadeIn, PulseGlow, CountUp |
| Hooks | 11 | useDebounce, useLocalStorage, useOnlineStatus |
| Smoke | 2 | Environment sanity |

**Testing principles:**
- Test behavior, not implementation
- Mock external dependencies
- Use `data-testid` for stable selectors
- Keep tests close to source (`src/test/` mirrors `src/app/`)

### 6.2 Running Tests

```bash
# All tests
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 7. Key Features & Pages

### 7.1 Dashboard (`/`)
- Revenue metrics with trend charts
- Pipeline overview
- Recent activity feed
- Quick action shortcuts

### 7.2 Pipeline (`/pipeline`)
- Drag-and-drop Kanban board
- 6 stages: Lead → Qualified → Proposal → Negotiation → Closed Won/Lost
- Deal cards with value, probability, close date
- Smart action button for quick operations

### 7.3 Clients (`/clients`)
- Contact directory with search/filter
- Company profiles
- Contact enrichment (AgentP)
- Import/export ready

### 7.4 Tasks (`/tasks`)
- Priority-based queue
- Due dates and assignments
- Local task store (offline support)
- Bulk operations

### 7.5 Inbox (`/inbox`)
- Unified email view
- Gmail/Outlook OAuth integration
- Thread-based conversations
- Email sync status

### 7.6 AgentP (`/agentp`)
- AI chat assistant
- Context-aware responses
- Deal/contact analysis
- Email draft suggestions
- Task prioritization

### 7.7 Settings (`/settings`)
- Profile management
- Team access control
- Integration connections
- AgentP configuration
- Appearance (dark/light mode)

---

## 8. AI Integration

### 8.1 AgentP (Frontend)

AgentP is the user-facing AI assistant:
- **Chat interface** on dedicated page + floating panel
- **Context awareness** — knows current page/route
- **Simulated responses** currently (full integration planned)
- **Russian language** support in UI

### 8.2 Backend AI Services

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Classify | `POST /ai/classify-message` | Lead scoring, intent, sentiment |
| Reply | `POST /ai/generate-reply` | Email reply suggestions |
| Score | `POST /ai/score-deal` | Deal health assessment |
| Recommend | `GET /ai/recommendations` | Action recommendations |
| Nemotron | `POST /nematron/chat` | General CRM assistance |
| Inbox Copilot | `POST /ai/inbox-copilot` | Context-aware inbox help |
| Project Intel | `POST /ai/project-intelligence/chat` | Codebase-aware assistant |

### 8.3 AI Data Fields

Messages include AI-enriched fields:
```typescript
interface Message {
  ai_lead_score?: number | null;
  ai_intent?: string | null;
  ai_priority?: string | null;
  ai_sentiment?: number | null;
  ai_product_relevance?: string | null;
}
```

---

## 9. Security & Privacy

### 9.1 Authentication
- **httpOnly session cookies** (no localStorage tokens)
- **Bcrypt password hashing**
- **JWT with refresh tokens**
- **CORS** configured for specific origins

### 9.2 API Security
- **Rate limiting** on AI endpoints (30 req/min)
- **API key module scopes** (contacts, deals, inbox, etc.)
- **Client trace IDs** for request tracking
- **SQL injection protection** via SQLAlchemy

### 9.3 Privacy-First AI
- **Local AI only** by default (`LOCAL_AI_ONLY=true`)
- **No outbound AI traffic** to cloud providers
- **LM Studio on localhost** (127.0.0.1:1234)
- **Approval-gated actions** — AI suggests, user approves
- **Full-disk encryption** assumed

---

## 10. Performance

### 10.1 Frontend Optimizations
- **Code splitting** — all routes lazy-loaded
- **67 JS chunks** in production build
- **Tree shaking** via Vite
- **PWA** with service worker caching
- **Debounced search** inputs
- **Optimistic updates** for mutations

### 10.2 Backend Optimizations
- **Async database queries** via SQLAlchemy
- **Connection pooling** with `pool_pre_ping`
- **Redis caching** for hot data
- **Event-driven architecture** for heavy operations

### 10.3 Build Stats
```
Build time: 2.33s
JS chunks: 67
Total size: ~1.2MB (gzipped)
Lighthouse: 95+ (estimated)
```

---

## 11. Deployment

### 11.1 Frontend
```bash
npm run build
# Deploy dist/ to static hosting (Cloudflare Pages, Vercel, etc.)
```

### 11.2 Backend
```bash
cd backend
docker build -t crmp-backend .
# Or use docker-compose for full stack
```

### 11.3 Required Services
- PostgreSQL 16+
- Redis 7+
- (Optional) LM Studio for AI

---

## 12. Troubleshooting

### Common Issues

**Frontend won't start:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Backend database connection:**
```bash
cd backend
docker compose up -d postgres
alembic upgrade head
```

**AI not responding:**
- Check LM Studio is running on port 1234
- Verify model is loaded: `nvidia/nemotron-3-nano-4b`
- Test: `curl http://127.0.0.1:1234/v1/models`

**Tests failing:**
```bash
npm run test -- --reporter=verbose
```

---

## 13. Resources

### Documentation
- `README.md` — Quick start guide
- `backend/README.md` — Backend setup
- `design-system/README.md` — Design tokens
- `MCP_README.md` — MCP integration
- `guidelines/Guidelines.md` — Coding guidelines

### External Links
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [FastAPI](https://fastapi.tiangolo.com)
- [SQLAlchemy](https://docs.sqlalchemy.org)
- [Lucide Icons](https://lucide.dev)

---

## 14. Changelog

### Phase 1 (Completed)
- ✅ Removed all LLM/AI/Swarm integrations from frontend
- ✅ Renamed CRM Agent → AgentP
- ✅ Updated to 2025 vibrant colors
- ✅ Fixed all build errors

### Phase 2 (Completed)
- ✅ Added 65 tests across 7 test files
- ✅ Page transitions with Framer Motion
- ✅ PWA support (service worker + manifest)
- ✅ Performance optimizations

### Phase 3 (In Progress)
- 🔄 AGENTS.md documentation
- 🔄 Kimi tool integration
- 🔄 README updates

---

## 15. Contact & Support

**Project:** CRMP by EmirCo  
**Maintainer:** Emir  
**License:** Proprietary

---

> **Note for AI Assistants:** When working on this codebase, always prefer:
> 1. Using existing shadcn/ui components over creating new ones
> 2. Following the established file naming conventions
> 3. Adding tests for new components/hooks
> 4. Using the design system tokens (no hardcoded colors)
> 5. Keeping components small and focused (< 200 lines ideally)
> 6. Using TypeScript strict mode (no `any`)
> 7. Preferring composition over prop drilling
