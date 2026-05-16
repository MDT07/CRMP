# CRMP Backend

This folder contains the Phase 1 FastAPI backend scaffold for CRMP. It is
structured to support the core CRM domains, event persistence, automation, and
AI integrations without forcing the heavier infrastructure pieces on day one.

## Included in the scaffold

- FastAPI app wiring and route registration
- Async SQLAlchemy session management
- Alembic bootstrap files
- Core models for organizations, users, companies, contacts, deals, messages,
  tasks, events, and automation rules
- Pydantic schemas and thin API routers
- Service layer entry points for auth, CRM domains, analytics, automation, and AI
- Event dispatcher with Postgres-first persistence and optional publisher hook
- AI helper modules for classification, reply generation, scoring, and recommendations

## Local setup

Run the following commands from the `backend/` directory.

1. Create and activate a virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

Use Python 3.9 or newer. Python 3.11 is still the best default if you have it,
but the scaffold now works correctly with the system Python 3.9 that ships on
many macOS setups.

2. Upgrade `pip` in the virtual environment. macOS Command Line Tools often ship
   an older `pip` that cannot perform editable installs from `pyproject.toml`:

```bash
python3 -m pip install --upgrade pip
```

3. Install the backend dependencies:

```bash
python3 -m pip install -e ".[dev]"
```

4. Copy `.env.example` to `.env`. The default `DATABASE_URL` and `REDIS_URL`
   already match the local Docker services in `docker-compose.yml`.

5. Start local infrastructure:

```bash
docker compose up -d postgres redis
```

If you only want the database and do not need Redis yet, you can start just
Postgres:

```bash
docker compose up -d postgres
```

6. Run the initial database migration:

```bash
alembic upgrade head
```

7. Start the API:

```bash
uvicorn app.main:app --reload
```

## Private-first defaults

The backend is now wired for a local, private-first CRM workflow:

- `docker-compose.yml` binds Postgres and Redis to `127.0.0.1` only.
- Auth uses an httpOnly session cookie instead of browser-stored bearer tokens.
- `LOCAL_AI_ONLY=true` blocks outbound AI traffic to hosted providers.
- Inbox copilot responses return evidence and approval-gated CRM actions.
- Approved AI writes still flow through the normal domain services and event system.
- Workspace API keys are issued and revoked by the backend and only reveal the raw secret once.
- This setup assumes your machine already uses full-disk encryption.

## Optional local AI with LM Studio

The backend can use a local LM Studio server for basic AI without a paid API.

1. Open LM Studio and load a local instruct/chat model.
2. Start the local server in LM Studio.
3. Update `backend/.env`:

```bash
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=
LLM_MODEL=nvidia/nemotron-3-nano-4b
LLM_MODEL_CHAT=nvidia/nemotron-3-nano-4b
LLM_MODEL_AGENT=nvidia/nemotron-3-nano-4b
LLM_MODEL_PROJECT_INTEL=nvidia/nemotron-3-nano-4b
LM_STUDIO_API_MODE=auto
LOCAL_AI_ONLY=true
```

4. Restart the backend:

```bash
uvicorn app.main:app --reload
```

Notes:

- CRMP is configured to use `nvidia/nemotron-3-nano-4b` as the default local
  model for chat, agent, and project intelligence flows.
- `LLM_API_KEY` can stay empty for LM Studio local mode, or be set if LM Studio
  auth is enabled on your machine.
- If you use multiple local models, keep `LLM_MODEL` as a safe fallback and
  override defaults by workflow with:
  - `LLM_MODEL_CHAT`
  - `LLM_MODEL_AGENT`
  - `LLM_MODEL_PROJECT_INTEL`
- If LM Studio is offline or no model is loaded, the backend falls back to the
  built-in heuristic AI helpers instead of crashing.
- The CRM copilot dock now uses the backend AI endpoints when you are in a live,
  signed-in workspace.
- Keep the frontend and backend on the same hostname during local development so
  the session cookie is accepted cleanly:
  - `http://127.0.0.1:5173` with `http://127.0.0.1:8000`
  - `http://127.0.0.1:5173` with `http://127.0.0.1:8000`

## Grounded inbox copilot

The private-first inbox copilot adds:

- `POST /api/v1/ai/inbox/copilot` for grounded thread responses
- `GET /api/v1/ai/proposals` to review approval-gated actions
- `POST /api/v1/ai/proposals/{proposal_id}/approve`
- `POST /api/v1/ai/proposals/{proposal_id}/reject`

Supported AI-proposed writes in this phase:

- Create a follow-up task
- Add an internal note
- Update contact status or tags
- Update deal stage or probability

Nothing is executed until you explicitly approve it.

## Project intelligence assistant

The backend now includes a real-time project/code analysis assistant:

- `GET /api/v1/ai/project-intelligence`
- `POST /api/v1/ai/project-intelligence/chat`

It scans the configured repository root, highlights recently changed hotspots,
returns navigation hints, and can answer implementation/navigation questions
using the live snapshot context.

Configuration:

- `PROJECT_ASSISTANT_ROOT` (default: repository root)
- `PROJECT_ASSISTANT_MAX_FILES` (default: `3000`)

## Workspace API keys

The settings screen now uses live backend endpoints for workspace API keys when
you are signed into a real workspace:

- `GET /api/v1/organizations/current/api-keys`
- `POST /api/v1/organizations/current/api-keys`
- `POST /api/v1/organizations/current/api-keys/{api_key_id}/revoke`

The backend stores only a hashed secret plus masked metadata. The raw secret is
returned only once when a key is created.
On successful API-key requests, `last_used_at` is updated automatically.
Per-key request limits are enforced (`API_KEY_RATE_LIMIT_REQUESTS_PER_MINUTE`,
default `240`) and return `429` with `Retry-After` when exceeded.
Successful API-key requests include `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
Repeated invalid key attempts are throttled by client identifier
(`API_KEY_INVALID_ATTEMPTS_PER_MINUTE`, default `60`).

Use workspace keys on server-to-server calls with:

- `X-CRMP-API-Key: <secret>`

Module scopes are enforced for API-key callers:

- `contacts`: `/companies/*`, `/contacts/*`
- `deals`: `/deals/*`
- `deals` or `automations`: `/tasks/*`
- `deals`: `/projects/*`
- `inbox`: `/messages/*`
- `automations`: `/automations/*`
- `analytics`: `/analytics/*`

Browser session auth continues to work as before and is not restricted by API
key module scopes.

## Local evals and backups

Run the local grounded inbox eval suite:

```bash
python scripts/run_private_ai_evals.py
```

Create a durable backup:

```bash
./scripts/export_private_backup.sh
```

Restore a backup:

```bash
./scripts/restore_private_backup.sh ./backups/<timestamp>
```

The durable Postgres backup includes CRM records plus:

- AI action proposals
- AI action executions
- Local AI eval runs
- Local AI eval samples

## Docker helpers

All commands below should also be run from the `backend/` directory.

Check service status:

```bash
docker compose ps
```

Follow Postgres logs:

```bash
docker compose logs -f postgres
```

Stop services:

```bash
docker compose down
```

Stop services and remove local data volumes:

```bash
docker compose down -v
```

## Notes

- The scaffold is designed so Postgres is the source of truth first.
- `docker-compose.yml` binds Postgres and Redis to `127.0.0.1` only.
- Alembic is configured for the async SQLAlchemy + `asyncpg` stack used by the app.
- Kafka, ClickHouse, and Elasticsearch are intentionally left behind interfaces
  or extension points for later phases.
- AI calls fall back safely when no reachable local LLM runtime is configured.
