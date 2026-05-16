# CRMP Development Skill

## Description
Development workflow helpers for the CRMP CRM platform.

## Triggers
- "Run CRMP tests"
- "Build CRMP frontend"
- "Start CRMP backend"
- "Check CRMP status"
- "Run CRM tests"
- "Build the project"

## Commands

### Test Frontend
```bash
npm run test
```

### Build Frontend
```bash
npm run build
```

### Type Check
```bash
npm run typecheck
```

### Start Backend
```bash
cd backend && uvicorn app.main:app --reload
```

### Run Backend Tests
```bash
cd backend && pytest
```

### Full Stack Check
```bash
# Frontend tests
npm run test

# Build check
npm run build

# Backend health (if running)
curl http://127.0.0.1:8000/ || echo "Backend not running"
```

## File Patterns
- `src/app/components/**/*.tsx` — React components
- `src/app/lib/*.ts` — API and utilities
- `backend/app/**/*.py` — Backend code
- `backend/app/models/*.py` — Database models
- `backend/app/api/*.py` — API routes
