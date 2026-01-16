# Desk Agent

Remote AI Agent system for executing code development, data processing, and general AI tasks on remote machines.

## Features

- **Task Execution**: Define reusable task templates with prompts and variables
- **Agent Configuration**: Customize Claude model, system prompts, and available tools
- **Real-time Streaming**: SSE-based live updates of task progress
- **Human-in-the-Loop**: Pause execution for human approval or input
- **Webhook Notifications**: Get notified when tasks start, complete, or fail
- **Logs & Artifacts**: Access execution logs and generated files

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Anthropic API Key

### Development Setup

```bash
# Clone and install
git clone https://github.com/zhaolion/desk-agent.git
cd desk-agent
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start dependencies (Redis)
docker-compose up -d redis

# Build all packages
pnpm build

# Start API (terminal 1)
cd apps/api && pnpm dev

# Start Worker (terminal 2)
cd apps/worker && pnpm dev
```

### Docker Deployment

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

docker-compose up -d
```

## API Reference

### Authentication

All API requests require an API key in the header:

```bash
curl -H "X-API-Key: dsk_test_development123456789" ...
```

### Endpoints

#### Tasks (Templates)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List task templates |
| POST | `/tasks` | Create task template |
| GET | `/tasks/:id` | Get task details |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| POST | `/tasks/:id/runs` | Execute task |

#### Runs (Executions)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/runs/:id` | Get run status |
| GET | `/runs/:id/events` | SSE event stream |
| POST | `/runs/:id/input` | Submit human input |
| POST | `/runs/:id/cancel` | Cancel execution |
| GET | `/runs/:id/logs` | List log files |
| GET | `/runs/:id/logs/:channel` | Get log content |
| GET | `/runs/:id/artifacts` | List artifacts |
| GET | `/runs/:id/artifacts/:name` | Download artifact |

#### Agents (Configurations)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agents` | List agents |
| POST | `/agents` | Create agent |
| GET | `/agents/:id` | Get agent |
| PATCH | `/agents/:id` | Update agent |
| DELETE | `/agents/:id` | Delete agent |

#### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhooks` | List webhooks |
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks/:id` | Get webhook |
| PATCH | `/webhooks/:id` | Update webhook |
| DELETE | `/webhooks/:id` | Delete webhook |
| POST | `/webhooks/:id/test` | Test webhook |

## Usage Examples

### Create an Agent

```bash
curl -X POST http://localhost:3000/agents \
  -H "X-API-Key: dsk_test_development123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Assistant",
    "model": "claude-sonnet-4-20250514",
    "systemPrompt": "You are a helpful coding assistant.",
    "tools": ["shell", "read_file", "write_file", "list_directory"]
  }'
```

### Create a Task Template

```bash
curl -X POST http://localhost:3000/tasks \
  -H "X-API-Key: dsk_test_development123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Run Tests",
    "agentId": "<agent-id>",
    "prompt": "Run the test suite and report results",
    "variables": {}
  }'
```

### Execute a Task

```bash
curl -X POST http://localhost:3000/tasks/<task-id>/runs \
  -H "X-API-Key: dsk_test_development123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Run all tests in the src directory"
  }'
```

### Stream Events (SSE)

```bash
curl -N http://localhost:3000/runs/<run-id>/events \
  -H "X-API-Key: dsk_test_development123456789"
```

### Setup Webhook

```bash
curl -X POST http://localhost:3000/webhooks \
  -H "X-API-Key: dsk_test_development123456789" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Notification",
    "url": "https://your-server.com/webhook",
    "events": ["task.completed", "task.failed"]
  }'
```

Webhook payloads are signed with HMAC-SHA256. Verify with the `X-Webhook-Signature` header.

## Architecture

```
desk-agent/
├── apps/
│   ├── api/          # REST API server (Hono)
│   └── worker/       # Agent executor (Claude SDK)
├── packages/
│   ├── domain/       # DDD entities & interfaces
│   └── shared/       # Common utilities
├── docker-compose.yml
└── .env.example
```

### Data Flow

1. Client creates task run via API
2. API enqueues task to Redis Stream
3. Worker consumes task, executes with Claude SDK
4. Worker publishes events to Redis Stream
5. API streams events to client via SSE
6. API dispatches webhooks on task events

## Built-in Tools

The worker includes these tools for Claude:

- `shell` - Execute shell commands
- `read_file` - Read file contents
- `write_file` - Write/create files
- `list_directory` - List directory contents

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `API_PORT` | API server port | 3000 |
| `API_HOST` | API server host | 0.0.0.0 |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `WORKER_DATA_DIR` | Worker data directory | /data/desk-agent |

## License

MIT
