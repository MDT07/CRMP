# CRMP Backend

FastAPI backend for CRMP — a modern CRM platform with AI-powered insights.

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Docker & Docker Compose
- LM Studio (optional, for AI features)

### Setup

```bash
cd backend

# 1. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Upgrade pip (important for editable installs)
python3 -m pip install --upgrade pip

# 3. Install dependencies
python3 -m pip install -e ".[dev]"

# 4. Configure environment
cp .env.example .env

# 5. Start infrastructure
docker compose up -d postgres redis

# 6. Run migrations
alembic upgrade head

# 7. Start API
uvicorn app.main:app --reload
```

API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000)

## 📚 API Documentation

- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## 🗄 Database

### Models (20 Entities)

| Model | Description |
|-------|-------------|
| `User` | Authentication & profiles |
| `Organization` | Workspace/tenant |
| `Company` | B2B accounts |
| `Contact` | People & leads |
| `Deal` | Sales opportunities |
| `Project` | Post-sale delivery |
| `Task` | Action items |
| `Message` | Communications |
| `EmailAccount` | Connected emails |
| `AutomationRule` | Workflow triggers |
| `Event` | Audit trail |
| `AIChatMessage` | AI conversations |
| `AIAgentRun` | Agent executions |
| `AIActionProposal` | Suggested actions |
| ... | ... |

### Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## 🤖 AI Services

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai/classify-message` | POST | Lead scoring, intent, sentiment |
| `/ai/generate-reply` | POST | Email reply suggestions |
| `/ai/score-deal` | POST | Deal health assessment |
| `/ai/recommendations` | GET | Action recommendations |
| `/ai/status` | GET | AI system status |
| `/nematron/chat` | POST | General CRM assistance |
| `/ai/inbox-copilot` | POST | Context-aware inbox help |
| `/ai/project-intelligence/chat` | POST | Codebase-aware assistant |

### Local AI Setup

1. Install [LM Studio](https://lmstudio.ai)
2. Download `nvidia/nemotron-3-nano-4b`
3. Start server on port 1234
4. Update `.env`:

```bash
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_MODEL=nvidia/nemotron-3-nano-4b
LLM_MODEL_CHAT=nvidia/nemotron-3-nano-4b
LLM_MODEL_AGENT=nvidia/nemotron-3-nano-4b
LOCAL_AI_ONLY=true
```

## 🔐 Security

- **httpOnly session cookies**
- **Bcrypt password hashing**
- **API key module scopes**
- **Rate limiting** (30 AI req/min, 240 API key req/min)
- **Local AI only** by default
- **Approval-gated AI actions**

## 🧪 Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app

# Run AI evals
python scripts/run_private_ai_evals.py
```

## 🛠 Development

### Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app factory
│   ├── api/                 # API routes
│   │   ├── router.py        # Route aggregator
│   │   ├── routes_auth.py
│   │   ├── routes_deals.py
│   │   └── ... (16 more)
│   ├── core/                # Config, logging, telemetry
│   ├── db/                  # Database session
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   ├── ai/                  # AI modules
│   └── events/              # Event system
├── alembic/                 # Migrations
├── scripts/                 # Utility scripts
├── docker-compose.yml       # Postgres + Redis
├── pyproject.toml           # Dependencies
└── .env.example             # Configuration template
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://crmp:crmp@127.0.0.1:5432/crmp
REDIS_URL=redis://127.0.0.1:6379/0

# Security
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=480

# AI
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=
LLM_MODEL=nvidia/nemotron-3-nano-4b
LOCAL_AI_ONLY=true

# Email OAuth
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret

# Frontend URL (for CORS)
FRONTEND_URL=http://127.0.0.1:3225
```

## 🐳 Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f postgres
docker compose logs -f redis

# Stop
docker compose down

# Reset (removes data)
docker compose down -v
```

## 📦 Scripts

```bash
# Export backup
./scripts/export_private_backup.sh

# Restore backup
./scripts/restore_private_backup.sh ./backups/<timestamp>

# Run AI evals
python scripts/run_private_ai_evals.py
```

## 📖 Documentation

- [FastAPI](https://fastapi.tiangolo.com)
- [SQLAlchemy](https://docs.sqlalchemy.org)
- [Alembic](https://alembic.sqlalchemy.org)
- [Pydantic](https://docs.pydantic.dev)

## 📝 License

Proprietary — EmirCo
