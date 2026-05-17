# CRMP MCP Integration

This directory contains Model Context Protocol (MCP) integration for the CRMP (CRM Platform) project.

## What is MCP?

Model Context Protocol (MCP) is a standard for connecting AI models to external tools, data sources, and APIs. It allows AI assistants to interact with CRM data and functionality through standardized tools.

## Files

- `mcp.json` - MCP client configuration
- `mcp-server.js` - MCP server implementation with CRM tools
- `README.md` - This documentation

## Available Tools

### 1. `crm_health_check`
Check the health status of CRMP backend services.

### 2. `crm_get_contacts`
Retrieve contacts from the CRM database.
- Parameters: `limit` (optional), `search` (optional)

### 3. `crm_get_deals`
Retrieve deals from the CRM database.
- Parameters: `limit` (optional), `stage` (optional)

### 4. `crm_ai_chat`
Chat with the CRMP AI assistant powered by Nemotron.
- Parameters: `message` (required), `context` (optional)

### 5. `crm_analytics_dashboard`
Get CRM analytics and dashboard metrics.
- Parameters: `metric_type` (optional: 'overview', 'growth', 'pipeline', 'performance')

### 6. `crm_create_task`
Create a new task in the CRM system.
- Parameters: `title` (required), `description` (optional), `priority` (optional), `due_date` (optional)

## Setup

1. **Install Dependencies:**
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

2. **Start CRMP Backend:**
   ```bash
   cd backend
   source .venv/bin/activate
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Test MCP Server:**
   ```bash
   node mcp-server.js
   ```

## Usage with AI Assistants

MCP allows AI assistants like Claude, ChatGPT, or custom models to:

- Query CRM data (contacts, deals, tasks)
- Get analytics and insights
- Create tasks and manage workflow
- Chat with the CRM AI assistant
- Access real-time CRM information

## Configuration

The `mcp.json` file configures the MCP client to connect to the CRMP MCP server. Environment variables:

- `CRMP_API_URL` - Backend API URL (default: http://127.0.0.1:8000/api/v1)
- `CRMP_FRONTEND_URL` - Frontend URL (default: http://127.0.0.1:5173)

## Integration Benefits

1. **Enhanced AI Capabilities** - AI assistants can access live CRM data
2. **Workflow Automation** - Create tasks and manage CRM operations via AI
3. **Real-time Insights** - Get current analytics and metrics
4. **Unified Interface** - Single protocol for all CRM interactions
5. **Extensibility** - Easy to add new CRM tools and capabilities

## Next Steps

- Integrate with popular AI assistants (Claude Desktop, VS Code extensions)
- Add authentication and security
- Implement real database queries (currently using mock data)
- Add more specialized CRM tools
- Create custom MCP clients for specific use cases
