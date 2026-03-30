# CRMP by EmirCo

CRMP by EmirCo is a full-stack CRM workspace with a React/Vite frontend and a
FastAPI backend. The frontend can run in preview mode on its own, while the
backend unlocks authentication, workspace data, and database-backed CRM flows.

## Full Project Activation (LM Studio + Backend + Frontend)

Use this flow when you want the full project running end-to-end with local AI.

1. Start local infrastructure and backend dependencies:

```bash
cd backend
docker compose up -d postgres redis
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
```

2. Start LM Studio local server and load your model:

```bash
lms server start --port 1234
lms load nvidia/nemotron-3-nano-4b --identifier local-model -y
```

3. Configure backend AI settings in `backend/.env`:

```bash
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=<your_lm_studio_token_if_auth_enabled>
LLM_MODEL=nvidia/nemotron-3-nano-4b
LLM_MODEL_CHAT=nvidia/nemotron-3-nano-4b
LLM_MODEL_AGENT=nvidia/nemotron-3-nano-4b
LLM_MODEL_PROJECT_INTEL=nvidia/nemotron-3-nano-4b
LM_STUDIO_API_MODE=auto
LOCAL_AI_ONLY=true
```

4. Start backend API (keep this terminal open):

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

5. Start frontend in a second terminal:

```bash
cd /Users/emirsemenov/Desktop/CRMP
npm install
npm run dev
```

6. Verify login and AI status from a third terminal:

```bash
rm -f /tmp/crmp.cookies
curl -c /tmp/crmp.cookies -X POST http://127.0.0.1:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"organization_name":"Emir CRM","organization_slug":"emir-crm-local","name":"Emir","email":"you@example.com","password":"ChangeMe12345"}'

curl -c /tmp/crmp.cookies -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"ChangeMe12345"}'

curl -b /tmp/crmp.cookies http://127.0.0.1:8000/api/v1/ai/status
```

Expected result: `/api/v1/ai/status` returns JSON with `"mode":"llm"`.

The AI Workspace page also includes a real-time project intelligence assistant
powered by:

- `GET /api/v1/ai/project-intelligence`
- `POST /api/v1/ai/project-intelligence/chat`

Optional backend config in `backend/.env`:

```bash
PROJECT_ASSISTANT_ROOT=..
PROJECT_ASSISTANT_MAX_FILES=3000
```

## Frontend

```bash
npm install
npm run dev
```

## Backend

Run these commands from `backend/`:

```bash
docker compose up -d postgres redis
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

## Database

The live backend is configured for:

- `PostgreSQL` as the primary database
- `Redis` for cache and background work
- `Alembic` for migrations

Update `backend/.env.example` or `backend/.env` with your local
database settings before running migrations. The included
`backend/docker-compose.yml` matches the default Postgres and Redis URLs.

For optional local AI, point `LLM_BASE_URL` in `backend/.env` to the local LM
Studio server at `http://127.0.0.1:1234/v1` and set `LLM_MODEL` plus the
workflow-specific overrides to `nvidia/nemotron-3-nano-4b`.

## Private-first defaults

- Postgres and Redis bind to `127.0.0.1` only in `backend/docker-compose.yml`.
- Backend auth uses an httpOnly session cookie instead of storing bearer tokens in browser storage.
- The AI stack is local-only by default. `LLM_BASE_URL` points to a localhost runtime and `LOCAL_AI_ONLY=true` blocks outbound model traffic.
- The inbox copilot returns grounded evidence and approval-gated CRM action proposals instead of performing writes directly.
- Workspace API keys are now issued and revoked server-side instead of being generated and stored in the browser.
- This setup assumes the host machine already has full-disk encryption enabled.

To keep cookie auth reliable during local development, use the same hostname for both apps:

- `http://localhost:5173` with `http://localhost:8000`
- `http://127.0.0.1:5173` with `http://127.0.0.1:8000`

## Local ops

Run the local grounded inbox eval suite from `backend/`:

```bash
python scripts/run_private_ai_evals.py
```

Create a private backup from `backend/`:

```bash
./scripts/export_private_backup.sh
```

Restore a backup from `backend/`:

```bash
./scripts/restore_private_backup.sh ./backups/<timestamp>
```
