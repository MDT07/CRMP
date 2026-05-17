# CRMP - Next-Generation CRM System

## Overview

CRMP is a comprehensive, enterprise-grade Customer Relationship Management system built with modern technologies and designed for sales teams, customer success managers, and business operations.

## 🚀 Features Implemented

### 1. **Modern Design System**
- ✅ Clean, minimalist interface inspired by Salesforce, HubSpot, and Notion
- ✅ Consistent component library using shadcn/ui
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ Light and dark mode support
- ✅ Smooth animations with Framer Motion
- ✅ Tailwind CSS for styling

### 2. **Core CRM Features**

#### Contact & Company Management
- **ClientsPage.tsx** - Full-featured contact directory
- Company profiles and associations
- Contact enrichment and tagging
- Search and filtering capabilities
- Import/Export functionality ready

#### Sales Pipeline (ENHANCED)
- **PipelinePage.tsx** - Drag-and-drop Kanban board
- 6 stages: Lead → Qualified → Proposal → Negotiation → Closed Won/Lost
- Drag-and-drop deal movement between stages
- Deal cards with value, probability, and close dates
- Real-time stage updates
- Priority indicators and tags

#### Task Management
- **TasksPage.tsx** - Complete task system
- Priority levels (High, Medium, Low)
- Due dates and reminders
- Assignment and status tracking
- Bulk operations
- Local task queue with sync capability

#### Email & Communication
- **MessagesPage.tsx** - Unified inbox
- Multi-channel support (Email, Chat, WhatsApp)
- AI-powered reply suggestions
- Approval-gated AI actions
- Thread-based conversation view
- File attachments

### 3. **Advanced Features**

#### Customer Timeline (NEW)
- **Timeline.tsx** - Visual activity timeline
- 15+ event types tracked
- Date grouping and filtering
- Interactive event cards
- Add notes directly to timeline
- Real-time activity feed

#### Workflow Automation Builder (NEW)
- **AutomationBuilder.tsx** - Visual workflow designer
- Trigger-based automation (deal stage changes, tasks, emails)
- Condition nodes for branching logic
- Action nodes (email, tasks, webhooks)
- Delay and scheduling capabilities
- Workflow status management

#### Drag-and-Drop Pipeline (NEW)
- **@dnd-kit** integration
- Smooth drag interactions
- Keyboard accessibility
- Visual feedback during drag
- Reordering within stages
- Cross-stage movement

### 4. **Technical Architecture**

#### Frontend Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State Management**: React Context + Hooks
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit

#### Backend Stack
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL + SQLAlchemy 2.0 (async)
- **Cache**: Redis
- **Migrations**: Alembic
- **Authentication**: JWT with httpOnly cookies
- **AI Integration**: LM Studio (local AI)
- **Real-time**: python-socketio (WebSockets ready)

#### Database Models (20 entities)
- Users, Organizations, OrganizationApiKey
- Companies, Contacts, Deals
- Projects, Tasks
- Messages, Notes, Events
- AutomationRule, AutomationRun
- AI action models (AiActionExecution, AiActionProposal, etc.)

### 5. **AI-Powered Features**
- Local AI assistant panel
- Deal scoring and recommendations
- Smart reply generation
- Contact enrichment suggestions
- Next-best-action recommendations
- Approval-gated AI actions
- Project intelligence service

### 6. **Security & Access Control**
- Role-based access control (RBAC) foundation
- API key management
- Rate limiting
- Session-based authentication (httpOnly cookies)
- CORS configuration
- Private-first AI (local only)

### 7. **Developer Experience**
- TypeScript throughout
- ESLint + Ruff for linting
- Hot reload in development
- Docker Compose for services
- Comprehensive test suite
- API documentation ready

## 📁 Project Structure

```
/Users/emirsemenov/Desktop/CRMP/
├── src/                          # Frontend source
│   ├── app/
│   │   ├── components/
│   │   │   ├── pages/           # Page components
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── ClientsPage.tsx
│   │   │   │   ├── PipelinePage.tsx    ← Drag-and-drop enhanced
│   │   │   │   ├── TasksPage.tsx
│   │   │   │   └── MessagesPage.tsx
│   │   │   ├── crm-ui/          # Custom CRM components
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Timeline.tsx     ← NEW
│   │   │   └── AutomationBuilder.tsx  ← NEW
│   │   ├── providers/           # React contexts
│   │   └── routes.ts
│   └── styles/
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── api/                 # API routes
│   │   ├── models/              # SQLAlchemy models
│   │   ├── services/            # Business logic
│   │   ├── ai/                  # AI/ML modules
│   │   └── main.py
│   ├── alembic/                 # Database migrations
│   └── tests/
├── docker-compose.yml           # PostgreSQL + Redis
└── package.json
```

## 🎯 Key Capabilities

### For Sales Teams
- Visual pipeline with drag-and-drop
- Deal tracking with probability scoring
- Automated follow-up reminders
- Email integration and templates
- Activity timeline per contact/deal

### For Customer Success
- 360° customer view
- Interaction history timeline
- Task management and assignments
- Health scoring (ready for implementation)
- Renewal and expansion tracking

### For Operations
- Workflow automation builder
- Custom field support (ready)
- API-first architecture
- Webhook integrations (ready)
- Real-time collaboration (WebSockets ready)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 16
- Redis 7

### Installation

1. **Clone and setup**
```bash
cd /Users/emirsemenov/Desktop/CRMP
npm install
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

2. **Start services**
```bash
cd backend
docker-compose up -d  # PostgreSQL + Redis
```

3. **Run migrations**
```bash
cd backend
alembic upgrade head
```

4. **Start backend**
```bash
cd backend
uvicorn app.main:app --reload
```

5. **Start frontend**
```bash
cd /Users/emirsemenov/Desktop/CRMP
npm run dev
```

6. **Access the app**
- Frontend: http://127.0.0.1:5173
- Backend API: http://127.0.0.1:8000
- API Docs: http://127.0.0.1:8000/docs

## 🎨 Design System

### Colors
- Primary: Dynamic based on theme
- Success: Green (#10b981)
- Warning: Amber (#f59e0b)
- Danger: Red (#ef4444)
- Info: Blue (#3b82f6)

### Typography
- Font: System fonts with metrics
- Hierarchy: Clear visual hierarchy
- Spacing: Consistent 4px grid

### Components
- 50+ shadcn/ui components
- Custom CRM components
- Responsive variants
- Dark mode support

## 📊 Dashboard Features

The main dashboard includes:
- **Revenue Chart**: Area chart with forecast and target lines
- **Metrics Cards**: Revenue, Pipeline, Win Rate, Unread
- **Today Queue**: Priority actions
- **Forecast Snapshot**: Pipeline health
- **Risk Pipeline**: At-risk deals
- **Inbox Pressure**: Communication stats
- **Automation Alerts**: Workflow status
- **Recent Activity**: Timeline view
- **Core Workspaces**: Quick navigation

## 🔧 Configuration

### Environment Variables (Backend)
```env
APP_NAME=CRMP Backend
DATABASE_URL=postgresql+asyncpg://crmp:crmp@127.0.0.1:5432/crmp
REDIS_URL=redis://127.0.0.1:6379/0
SECRET_KEY=your-secret-key
LLM_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_AI_ONLY=true
```

### Features Ready for Extension
- Custom fields for contacts/companies/deals
- Advanced reporting and analytics
- Multi-tenant organizations
- Integration marketplace
- Mobile app (PWA ready)
- Advanced RBAC permissions
- Workflow templates library

## 📱 Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: 1024px - 1280px
- Large Desktop: > 1280px

## 🧪 Testing

```bash
# Frontend linting
npm run lint

# Backend testing
cd backend
pytest

# Python linting
ruff check .
```

## 🚢 Deployment

### Docker Production
```bash
# Build frontend
npm run build

# Build backend Docker image
cd backend
docker build -t crmp-backend .

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Config
- Development: `.env`
- Staging: `.env.staging`
- Production: `.env.production`

## 📝 API Documentation

FastAPI auto-generates interactive docs:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## 🤖 AI Features

### Local AI Setup
1. Install LM Studio
2. Download nvidia/nemotron-3-nano-4b model
3. Start local server on port 1234
4. Configure `LLM_BASE_URL` in backend .env

### AI Capabilities
- Smart reply generation
- Deal scoring
- Contact enrichment
- Task suggestions
- Pipeline insights

## 🔐 Security

- ✅ JWT authentication with refresh tokens
- ✅ httpOnly session cookies
- ✅ CORS configured
- ✅ Rate limiting
- ✅ SQL injection protection (SQLAlchemy)
- ✅ XSS protection (React sanitization)
- ✅ API key management
- ✅ No secrets in git (gitignore configured)

## 📈 Performance

- Code splitting with lazy loading
- Virtual scrolling for large lists
- Debounced search
- Optimistic updates
- Redis caching
- Database query optimization
- Image optimization

## 🎓 Best Practices

- Component-based architecture
- Custom hooks for reusable logic
- Type safety with TypeScript
- Accessibility (ARIA labels, keyboard nav)
- Error boundaries
- Loading states
- Toast notifications
- Form validation

## 🔄 Git Workflow

```bash
# Initial setup
git init
git add .
git commit -m "Initial commit"

# Feature development
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git checkout main
git merge feature/new-feature
```

## 📞 Support

For issues and feature requests:
- Check existing issues in GitHub
- Review documentation
- Contact development team

## 📄 License

Proprietary - EmirCo

---

**Built with ❤️ by EmirCo**  
*Next-generation CRM for modern sales teams*
