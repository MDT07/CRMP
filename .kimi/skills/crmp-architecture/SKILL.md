# CRMP Architecture Guide

## Description
Architecture patterns and system design for CRMP.

## Triggers
- "Architecture"
- "System design"
- "How does this work"
- "Data flow"
- "Component structure"

## Frontend Architecture

### Component Hierarchy
```
App
├── ThemeProvider
│   └── CrmProvider
│       └── RouterProvider
│           ├── AuthRoute (/auth)
│           └── ProtectedCrmRoute
│               └── Layout
│                   ├── Sidebar
│                   ├── TopBar
│                   └── Main Content
│                       └── PageTransition
│                           └── Current Page
```

### State Management
- **Local**: useState, useReducer
- **Global**: React Context (CrmProvider, ThemeProvider)
- **Server**: React Query pattern (fetch + cache)
- **Form**: React Hook Form

### Data Flow
```
User Action → Component → Hook → API Client → Backend → State Update → Re-render
```

## Backend Architecture

### Request Lifecycle
```
HTTP Request → CORS → Trace ID → Auth → Rate Limit → Route → Dependencies → Service → Response
```

### Multi-Tenancy
All data scoped to `organization_id`:
- Every model has `organization_id` foreign key
- Every query filters by organization
- API keys have module scopes

### Event System
```
Action → Database Write → Event Published → Subscribers → Side Effects
```

## Database Design

### Core Relationships
```
Organization
├── User (many)
├── Company (many)
│   └── Contact (many)
├── Deal (many)
│   └── Project (one)
├── Task (many)
├── Message (many)
└── Event (audit trail)
```

## AI Integration

### Service Layers
```
API Router → Service → LLMClient → Local LM Studio
```

### Prompt Pattern
```python
context = build_context(user, page, selection)
prompt = template.format(context=context, query=query)
response = await llm.chat_completion(prompt)
return parse_and_validate(response)
```

## Security Model

### Authentication
- httpOnly session cookies
- JWT with refresh tokens
- Bcrypt password hashing

### Authorization
- Role-based (admin, manager, rep)
- API key module scopes
- Organization isolation

## Performance

### Frontend
- Code splitting (67 chunks)
- Lazy loading
- PWA caching
- Debounced inputs

### Backend
- Async database queries
- Connection pooling
- Redis caching
- Event-driven processing
