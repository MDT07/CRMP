# CRMP Troubleshooting

## Description
Common issues and solutions for CRMP development.

## Triggers
- "Error"
- "Not working"
- "Failed"
- "Bug"
- "Issue"
- "Problem"

## Frontend Issues

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Type Errors
```bash
# Check types
npm run typecheck

# Common fixes
# - Add type annotations
# - Update @types packages
# - Check tsconfig.json
```

### Test Failures
```bash
# Run with verbose output
npm run test -- --reporter=verbose

# Run specific test
npm run test -- src/test/components/Brand.test.tsx

# Update snapshots
npm run test -- -u
```

### Port Already in Use
```bash
# Kill process on port 3225
lsof -ti:3225 | xargs kill -9

# Or use different port
npm run dev -- --port 3226
```

## Backend Issues

### Database Connection
```bash
# Check Postgres is running
docker compose ps

# Restart Postgres
docker compose restart postgres

# Check logs
docker compose logs postgres

# Reset database (WARNING: data loss)
docker compose down -v
docker compose up -d postgres
alembic upgrade head
```

### Migration Errors
```bash
# Check current revision
alembic current

# History
alembic history

# Stamp to specific revision
alembic stamp <revision>

# Create fresh migration
alembic revision --autogenerate -m "fix"
```

### AI Not Responding
```bash
# Check LM Studio
curl http://127.0.0.1:1234/v1/models

# Check backend AI status
curl http://127.0.0.1:8000/api/v1/ai/status

# Restart LM Studio
# 1. Open LM Studio
# 2. Load model
# 3. Start server
```

### Import Errors
```bash
# Ensure PYTHONPATH is set
export PYTHONPATH=backend

# Or use python -m
python -m app.main
```

## Common Solutions

### Full Reset
```bash
# Frontend
rm -rf node_modules package-lock.json dist
npm install

# Backend
cd backend
rm -rf .venv __pycache__ .pytest_cache
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"

# Infrastructure
docker compose down -v
docker compose up -d
alembic upgrade head
```

### Check Services
```bash
# Frontend
curl http://127.0.0.1:3225 || echo "Frontend not running"

# Backend
curl http://127.0.0.1:8000/ || echo "Backend not running"

# Postgres
docker compose exec postgres pg_isready -U crmp

# Redis
docker compose exec redis redis-cli ping

# LM Studio
curl http://127.0.0.1:1234/v1/models || echo "LM Studio not running"
```

## Debug Mode

### Frontend
```bash
# Verbose build
npm run build -- --debug

# Source maps
# Already enabled in vite.config.ts
```

### Backend
```bash
# Debug logging
DEBUG=true uvicorn app.main:app --reload

# SQL echo
SQL_ECHO=true uvicorn app.main:app --reload
```

## Getting Help

1. Check `AGENTS.md` for architecture details
2. Review `backend/README.md` for API docs
3. Check logs: `docker compose logs -f`
4. Run health checks: `curl http://127.0.0.1:8000/`
