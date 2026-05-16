# Contributing to CRMP

Thank you for your interest in contributing to CRMP by EmirCo! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Git

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Type check
npm run typecheck
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"

# Start infrastructure
docker compose up -d postgres redis

# Run migrations
alembic upgrade head

# Start API
uvicorn app.main:app --reload
```

## Project Structure

```
crmp/
├── src/                    # Frontend source
│   ├── app/
│   │   ├── components/     # React components
│   │   ├── lib/            # API & utilities
│   │   ├── providers/      # Context providers
│   │   └── hooks/          # Custom hooks
│   ├── test/               # Test suite
│   └── styles/             # CSS & tokens
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic
│   │   └── ai/             # AI modules
│   └── alembic/            # Migrations
└── AGENTS.md               # AI assistant guide
```

## Coding Standards

### TypeScript/React
- Use TypeScript strict mode
- Functional components with hooks
- Named exports only
- Props interfaces defined
- Lucide icons only
- Tailwind design tokens (no hardcoded values)

### Python
- Type hints everywhere
- Async/await for I/O
- Pydantic for validation
- SQLAlchemy 2.0 style
- Black formatting (line length 100)

### File Naming
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts`
- Utilities: `camelCase.ts`
- API routes: `routes_*.py`
- Models: `snake_case.py`

## Component Guidelines

### Creating New Components

1. Check existing shadcn/ui components first
2. Follow the component template:

```tsx
import { useState } from "react";
import { cn } from "../ui/utils";

interface MyComponentProps {
  title: string;
  variant?: "default" | "accent";
}

export function MyComponent({ title, variant = "default" }: MyComponentProps) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      variant === "accent" && "border-primary/20 bg-primary-soft"
    )}>
      {title}
    </div>
  );
}
```

### Rules
- Keep components under 200 lines
- Use composition over props drilling
- Add `data-testid` for testing
- Handle loading and error states
- Use existing design tokens

## Testing

### Frontend Tests
```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Backend Tests
```bash
cd backend
pytest
```

### Writing Tests
- Test behavior, not implementation
- Mock external dependencies
- Use `data-testid` for selectors
- Keep tests close to source

## API Development

### Adding New Endpoints

1. Create route file in `backend/app/api/`
2. Add to `backend/app/api/router.py`
3. Create Pydantic schemas in `backend/app/schemas/`
4. Add service methods in `backend/app/services/`
5. Write tests

### Example

```python
# backend/app/api/routes_example.py
from fastapi import APIRouter

router = APIRouter(prefix="/examples", tags=["examples"])

@router.get("")
async def list_examples() -> list[ExampleRead]:
    return await ExampleService().list_examples()
```

## Database Migrations

```bash
cd backend

# Create migration
alembic revision --autogenerate -m "add new table"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Commit Messages

Use conventional commits:

```
feat: add new dashboard widget
fix: resolve pipeline drag issue
docs: update API documentation
test: add deal scoring tests
refactor: simplify auth middleware
style: fix formatting
```

## Pull Request Process

1. Create feature branch: `git checkout -b feature/name`
2. Make changes with tests
3. Ensure all tests pass
4. Update documentation
5. Submit PR with description

## Code Review

All submissions require review. We check for:
- Code quality and style
- Test coverage
- Documentation updates
- Performance impact
- Security considerations

## Questions?

- Check `AGENTS.md` for detailed architecture
- Review existing code for patterns
- Open an issue for discussion

## License

Proprietary — EmirCo
