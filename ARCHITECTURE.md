# CRMP Architecture

## System Overview

CRMP is a modern CRM platform built with a clear separation between frontend and backend, connected via REST APIs with cookie-based authentication.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Browser   │  │   Mobile    │  │   Desktop PWA       │ │
│  │   (React)   │  │   (PWA)     │  │   (Electron)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS / HTTP
┌─────────────────────────────────────────────────────────────┐
│                      LOAD BALANCER                           │
│              (Nginx / Cloudflare / AWS ALB)                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│      FRONTEND           │    │        BACKEND              │
│  Static File Server     │    │    FastAPI Application      │
│  (CDN / S3 / Vercel)    │    │    (Uvicorn / Gunicorn)     │
└─────────────────────────┘    └─────────────────────────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
                    │  PostgreSQL │  │    Redis    │  │  LM Studio  │
                    │  (Primary)  │  │   (Cache)   │  │  (Local AI) │
                    └─────────────┘  └─────────────┘  └─────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App
├── ThemeProvider
│   └── CrmProvider
│       └── RouterProvider
│           ├── AuthRoute (/auth)
│           │   └── AuthPage
│           └── ProtectedCrmRoute
│               └── Layout
│                   ├── Sidebar
│                   │   ├── BrandLockup
│                   │   ├── Navigation (shell-nav)
│                   │   └── ConnectionStatus
│                   ├── TopBar
│                   │   ├── Search
│                   │   ├── QuickActions
│                   │   └── UserMenu
│                   └── Main Content
│                       ├── PageTransition
│                       │   └── Outlet (current page)
│                       └── AgentPPanel (floating)
```

### State Flow

```
User Action
    │
    ▼
Component (local state: useState)
    │
    ▼
Custom Hook (business logic)
    │
    ▼
API Client (crm-api.ts)
    │
    ▼
Backend API
    │
    ▼
CrmProvider (global state update)
    │
    ▼
UI Re-render
```

### Data Fetching Pattern

```typescript
// Hook pattern for data fetching
function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeals()
      .then(data => setDeals(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { deals, loading, error, refresh: () => fetchDeals() };
}
```

## Backend Architecture

### Request Lifecycle

```
HTTP Request
    │
    ▼
CORS Middleware
    │
    ▼
Trace ID Middleware (OpenTelemetry)
    │
    ▼
Auth Middleware (session cookie / API key)
    │
    ▼
Rate Limiting (Redis-based)
    │
    ▼
Route Handler
    │
    ▼
Dependency Injection
    │
    ├─> get_db_session → AsyncSession
    ├─> get_current_user → User
    └─> get_settings → Settings
    │
    ▼
Service Layer
    │
    ├─> Business logic
    ├─> Database queries
    └─> External API calls
    │
    ▼
Response Serialization (Pydantic)
    │
    ▼
HTTP Response + Trace ID Header
```

### Multi-Tenancy

All data is scoped to `organization_id`:

```python
# Every query includes organization filter
async def get_deals(self, organization_id: UUID) -> list[Deal]:
    result = await self.session.execute(
        select(Deal)
        .where(Deal.organization_id == organization_id)
        .order_by(Deal.created_at.desc())
    )
    return result.scalars().all()
```

### Event-Driven Architecture

```
User Action
    │
    ▼
API Handler
    │
    ├─> Database Write
    │
    └─> EventDispatcher.publish()
            │
            ├─> PostgreSQL (Event table)
            │
            ├─> Local Subscribers (sync)
            │       ├─> Send notification
            │       ├─> Update cache
            │       └─> Trigger automation
            │
            └─> External Publisher (async)
                    ├─> Redis Pub/Sub
                    ├─> Kafka (future)
                    └─> WebSocket broadcast
```

## Database Schema

### Core Entities

```
Organization
├── User[]
├── Company[]
│   └── Contact[]
├── Deal[]
│   └── Project (1:1)
├── Task[]
├── Message[]
├── EmailAccount[]
│   └── EmailMessage[]
├── AutomationRule[]
│   └── AutomationRuleRun[]
├── Note[]
└── Event[] (audit trail)
```

### AI Entities

```
AIChatMessage (conversation history)
AIAgentRun (execution logs)
AIActionProposal (suggested actions)
AIActionExecution (approved actions)
AIEvalRun / AIEvalSample (evaluations)
```

## AI Architecture

### Service Layers

```
User Request
    │
    ▼
API Router (/ai/*, /nematron/*)
    │
    ▼
Service Layer
    │
    ├─> AIService (core AI)
    ├─> NematronCRMService (Nemotron model)
    ├─> GroundedInboxService (context-aware)
    ├─> ProjectIntelligenceService (codebase)
    └─> MultiAgentService (orchestration)
    │
    ▼
LLMClient
    │
    ├─> Local LM Studio (default)
    ├─> OpenAI-compatible endpoint
    └─> Fallback (no AI)
    │
    ▼
Response with grounding + evidence
```

### Prompt Engineering

```python
# Structured prompts with context
async def generate_reply(self, message: Message) -> ReplyGenerationResult:
    prompt = reply_prompt.format(
        message_body=message.body,
        contact_name=message.contact.name,
        deal_title=message.deal.title if message.deal else None,
        recent_activity=recent_activity,
    )
    
    response = await self.llm_client.chat_completion(prompt)
    return parse_reply_response(response)
```

## Security Architecture

### Authentication Flow

```
User
  │
  ▼ POST /auth/login
Credentials
  │
  ▼
AuthService.verify_password()
  │
  ▼
Session Created (JWT + Redis)
  │
  ▼
httpOnly Cookie Set
  │
  ▼
Subsequent Requests
  │
  ▼
Auth Middleware
  │
  ├─> Read cookie
  ├─> Verify JWT
  ├─> Check Redis session
  └─> Load User
  │
  ▼
Request Handler
```

### API Key Flow

```
Client Request
  │
  ▼
X-CRMP-API-Key Header
  │
  ▼
API Key Middleware
  │
  ├─> Hash comparison
  ├─> Module scope check
  ├─> Rate limit check
  └─> Update last_used_at
  │
  ▼
Request Handler
```

## Deployment Architecture

### Development

```
Local Machine
├── Frontend (Vite dev server, port 3225)
├── Backend (Uvicorn, port 8000)
├── PostgreSQL (Docker, port 5432)
├── Redis (Docker, port 6379)
└── LM Studio (port 1234)
```

### Production (Recommended)

```
Cloud Infrastructure
├── CDN (Static assets)
├── Load Balancer
├── App Servers (FastAPI, auto-scaling)
├── Database (PostgreSQL HA)
├── Cache (Redis Cluster)
└── Object Storage (Backups)
```

## Performance Considerations

### Frontend
- Code splitting (67 chunks)
- Lazy route loading
- PWA caching
- Debounced inputs
- Optimistic updates

### Backend
- Async database queries
- Connection pooling
- Redis caching
- Event-driven processing
- Rate limiting

### Database
- Indexed foreign keys
- Composite indexes for common queries
- JSONB for flexible metadata
- Partitioning for events (future)

## Monitoring

### Telemetry
- OpenTelemetry tracing
- Request trace IDs
- Performance metrics
- Error tracking

### Logging
- Structured JSON logs
- Correlation IDs
- Sensitive data redaction
- Log levels per environment

## Future Enhancements

### Short Term
- WebSocket real-time updates
- Advanced search (Elasticsearch)
- Mobile app (React Native)

### Long Term
- Multi-region deployment
- GraphQL API
- Machine learning pipeline
- Voice assistant integration
