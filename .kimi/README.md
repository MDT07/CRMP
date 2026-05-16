# Kimi Configuration for CRMP

This directory contains Kimi CLI configuration and custom skills for the CRMP project.

## Quick Start

```bash
# Navigate to project
cd /Users/emirsemenov/Desktop/CRMP

# Use project config
kimi --config-file .kimi/config.toml
```

## Configuration

### config.toml
Main Kimi configuration:
- Project name and description
- Agent settings (max steps, retries)
- MCP server configuration
- Skills directory

### mcp.json
MCP server configuration:
- `crmp-backend`: Connects to FastAPI backend

## Skills

| Skill | Description | Example Triggers |
|-------|-------------|-----------------|
| `crmp-dev` | Development workflows | "Run tests", "Build frontend" |
| `crmp-component` | Component generation | "Create component", "New button" |
| `crmp-api` | Backend API development | "Create API", "Add endpoint" |
| `crmp-design` | Design system reference | "Color token", "Shadow" |
| `crmp-testing` | Testing helpers | "Write test", "Test hook" |
| `crmp-architecture` | System architecture | "How it works", "Data flow" |
| `crmp-troubleshooting` | Common issues | "Error", "Not working" |

## Usage Examples

### Development
```bash
kimi "Run CRMP tests"
kimi "Build the frontend"
kimi "Check project status"
```

### Component Generation
```bash
kimi "Create a new MetricCard component"
kimi "Generate a StatusBadge variant"
```

### API Development
```bash
kimi "Create a new deals endpoint"
kimi "Add contact search API"
```

### Design
```bash
kimi "What are the primary colors?"
kimi "Show me the shadow tokens"
```

### Troubleshooting
```bash
kimi "Frontend build failed"
kimi "Backend not connecting"
```

## Adding New Skills

Create a new directory in `.kimi/skills/`:

```bash
mkdir .kimi/skills/your-skill
cat > .kimi/skills/your-skill/SKILL.md << 'SKILL'
# Your Skill Name

## Description
What this skill does.

## Triggers
- "trigger phrase 1"
- "trigger phrase 2"

## Content
Your skill content here.
SKILL
```

## Documentation

- `AGENTS.md` — Comprehensive project guide
- `ARCHITECTURE.md` — System architecture
- `CONTRIBUTING.md` — Contribution guidelines
- `backend/README.md` — Backend documentation
