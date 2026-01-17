# Sprint 0: Automated Acceptance Infrastructure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build automated testing infrastructure to validate each implementation step before proceeding to the next.

**Architecture:** Three-tier testing strategy: Unit tests (Vitest), Integration tests (API), E2E tests (Playwright).

**Tech Stack:** Vitest, Supertest, Playwright, Docker Compose (for test DB/Redis)

---

## Testing Strategy Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Automated Acceptance Pyramid                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────────┐                          │
│                    │   E2E Tests     │  ← Playwright            │
│                    │   (Web UI)      │    User flows            │
│                    └────────┬────────┘                          │
│                             │                                    │
│              ┌──────────────┴──────────────┐                    │
│              │    Integration Tests        │  ← Supertest       │
│              │    (API endpoints)          │    HTTP requests   │
│              └──────────────┬──────────────┘                    │
│                             │                                    │
│     ┌───────────────────────┴───────────────────────┐           │
│     │              Unit Tests                        │  ← Vitest │
│     │    (Services, Utils, Domain logic)            │           │
│     └───────────────────────────────────────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria Per Sprint

| Sprint | Acceptance Test | Pass Criteria |
|--------|-----------------|---------------|
| Sprint 0 | `pnpm test` | All tests pass, coverage > 0% |
| Sprint 1 | `pnpm test:e2e` | Login, agents CRUD, tasks CRUD, run viewer |
| Sprint 2 | `pnpm test:e2e` + Stripe mock | Checkout, subscription, webhook handling |
| Sprint 3 | Integration tests | S3 upload/download, custom tools |
| Sprint 4 | E2E + OAuth mock | OAuth login flow |

---

## Task 1: Root Testing Configuration

**Files:**
- Create: `vitest.workspace.ts`
- Modify: `package.json`
- Modify: `turbo.json`

**Step 1: Create vitest workspace config**

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/api',
  'apps/worker',
  'apps/web',
  'packages/domain',
  'packages/shared',
])
```

**Step 2: Update root package.json**

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "turbo run test:e2e",
    "test:ci": "pnpm test && pnpm test:e2e",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:test:up": "docker compose -f docker-compose.test.yml up -d",
    "db:test:down": "docker compose -f docker-compose.test.yml down -v",
    "acceptance": "./scripts/acceptance.sh",
    "acceptance:check": "npx tsx scripts/acceptance-check.ts"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "tsx": "^4.7.0"
  }
}
```

**Step 3: Update turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {},
    "clean": {
      "cache": false
    }
  }
}
```

**Step 4: Install vitest at root**

Run: `pnpm add -D vitest @vitest/coverage-v8 tsx -w`
Expected: Dependencies installed

**Step 5: Commit**

```bash
git add vitest.workspace.ts package.json turbo.json pnpm-lock.yaml
git commit -m "feat: add vitest workspace configuration"
```

---

## Task 2: Test Database Configuration

**Files:**
- Create: `docker-compose.test.yml`
- Create: `scripts/wait-for-db.sh`

**Step 1: Create docker-compose.test.yml**

```yaml
# docker-compose.test.yml
version: "3.8"

services:
  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: desk_agent_test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d desk_agent_test"]
      interval: 5s
      timeout: 5s
      retries: 5

  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Step 2: Create wait-for-db script**

```bash
#!/bin/bash
# scripts/wait-for-db.sh

set -e

echo "Waiting for PostgreSQL..."
until PGPASSWORD=test psql -h localhost -p 5433 -U test -d desk_agent_test -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo "PostgreSQL is ready!"

echo "Waiting for Redis..."
until redis-cli -h localhost -p 6380 ping 2>/dev/null; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "Redis is ready!"

echo "All services are ready!"
```

**Step 3: Make script executable**

Run: `chmod +x scripts/wait-for-db.sh`

**Step 4: Commit**

```bash
git add docker-compose.test.yml scripts/
git commit -m "feat: add test database docker compose"
```

---

## Task 3: API Test Configuration

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/test/setup.ts`
- Create: `apps/api/src/test/helpers.ts`
- Refactor: `apps/api/src/main.ts` (extract createApp)

**Step 1: Refactor main.ts to export createApp**

We need to separate app creation from server start for testing:

```typescript
// apps/api/src/main.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
// ... other imports

export function createApp() {
  const app = new Hono()

  // Middleware
  app.use('*', cors())

  // Routes
  app.route('/health', healthRoutes)
  app.route('/auth', authRoutes)
  app.route('/users', userRoutes)
  app.route('/api-keys', apiKeyRoutes)
  app.route('/agents', agentRoutes)
  app.route('/tasks', taskRoutes)
  app.route('/webhooks', webhookRoutes)
  app.route('/teams', teamRoutes)
  app.route('/billing', billingRoutes)

  return app
}

// Only start server if this is the main module
const app = createApp()
export default app
```

**Step 2: Update apps/api/package.json**

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0"
  }
}
```

**Step 3: Create vitest.config.ts for API**

```typescript
// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5433/desk_agent_test',
      REDIS_URL: 'redis://localhost:6380',
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      PORT: '3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 4: Create test setup file**

```typescript
// apps/api/src/test/setup.ts
import { beforeAll, afterAll, beforeEach } from 'vitest'

beforeAll(async () => {
  console.log('Setting up test environment...')
})

beforeEach(async () => {
  // Will add database cleanup here when we have migrations
})

afterAll(async () => {
  console.log('Tearing down test environment...')
})
```

**Step 5: Create test helpers**

```typescript
// apps/api/src/test/helpers.ts
export interface TestUser {
  id: string
  email: string
  token: string
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}
```

**Step 6: Install test dependencies in api**

Run: `cd apps/api && pnpm add -D vitest @vitest/coverage-v8`

**Step 7: Commit**

```bash
git add apps/api/
git commit -m "feat(api): add vitest test configuration"
```

---

## Task 4: First API Test (Health Check)

**Files:**
- Create: `apps/api/src/routes/health.test.ts`

**Step 1: Create health check test**

```typescript
// apps/api/src/routes/health.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../main'

describe('Health Routes', () => {
  const app = createApp()

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const res = await app.request('/health')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('status', 'ok')
    })
  })
})
```

**Step 2: Run the test**

Run: `cd apps/api && pnpm test`
Expected: 1 test passes

**Step 3: Commit**

```bash
git add apps/api/src/routes/health.test.ts
git commit -m "test(api): add health check test"
```

---

## Task 5: Acceptance Check Script

**Files:**
- Create: `scripts/acceptance-check.ts`

**Step 1: Create acceptance check script**

```typescript
// scripts/acceptance-check.ts
/**
 * Acceptance Check - Validates sprint completion criteria
 *
 * Usage: npx tsx scripts/acceptance-check.ts <sprint-number>
 */

import { existsSync, readdirSync } from 'fs'
import { spawnSync } from 'child_process'

interface SprintCriteria {
  name: string
  checks: Check[]
}

interface Check {
  name: string
  test: () => boolean
  required: boolean
}

function fileExists(path: string): boolean {
  return existsSync(path)
}

function hasTestFiles(dir: string): boolean {
  try {
    const files = readdirSync(dir, { recursive: true }) as string[]
    return files.some(f => f.endsWith('.test.ts'))
  } catch {
    return false
  }
}

function runCommand(cmd: string, args: string[]): boolean {
  const result = spawnSync(cmd, args, { stdio: 'pipe' })
  return result.status === 0
}

const sprintCriteria: Record<number, SprintCriteria> = {
  0: {
    name: 'Sprint 0: Automated Acceptance Infrastructure',
    checks: [
      {
        name: 'Vitest workspace configured',
        test: () => fileExists('vitest.workspace.ts'),
        required: true,
      },
      {
        name: 'Docker test compose exists',
        test: () => fileExists('docker-compose.test.yml'),
        required: true,
      },
      {
        name: 'API vitest config exists',
        test: () => fileExists('apps/api/vitest.config.ts'),
        required: true,
      },
      {
        name: 'API tests exist',
        test: () => hasTestFiles('apps/api/src'),
        required: true,
      },
      {
        name: 'pnpm build passes',
        test: () => runCommand('pnpm', ['build']),
        required: true,
      },
      {
        name: 'pnpm test passes',
        test: () => runCommand('pnpm', ['test']),
        required: true,
      },
    ],
  },
  1: {
    name: 'Sprint 1: Web Frontend Foundation',
    checks: [
      {
        name: 'Web app exists',
        test: () => fileExists('apps/web/package.json'),
        required: true,
      },
      {
        name: 'Login page exists',
        test: () => fileExists('apps/web/src/pages/Login.tsx'),
        required: true,
      },
      {
        name: 'Register page exists',
        test: () => fileExists('apps/web/src/pages/Register.tsx'),
        required: true,
      },
      {
        name: 'Dashboard page exists',
        test: () => fileExists('apps/web/src/pages/Dashboard.tsx'),
        required: true,
      },
      {
        name: 'Agents page exists',
        test: () => fileExists('apps/web/src/pages/Agents.tsx'),
        required: true,
      },
      {
        name: 'Tasks page exists',
        test: () => fileExists('apps/web/src/pages/Tasks.tsx'),
        required: true,
      },
      {
        name: 'TaskRun page exists',
        test: () => fileExists('apps/web/src/pages/TaskRun.tsx'),
        required: true,
      },
      {
        name: 'E2E tests exist',
        test: () => fileExists('apps/web/e2e'),
        required: true,
      },
      {
        name: 'pnpm build passes',
        test: () => runCommand('pnpm', ['build']),
        required: true,
      },
    ],
  },
  2: {
    name: 'Sprint 2: Payments (Stripe)',
    checks: [
      {
        name: 'Stripe service exists',
        test: () => fileExists('apps/api/src/services/stripe.service.ts'),
        required: true,
      },
      {
        name: 'Stripe webhook route exists',
        test: () => fileExists('apps/api/src/routes/stripe-webhook/index.ts'),
        required: true,
      },
      {
        name: 'Billing page exists',
        test: () => fileExists('apps/web/src/pages/Billing.tsx'),
        required: true,
      },
    ],
  },
  3: {
    name: 'Sprint 3: Storage & Tools',
    checks: [
      {
        name: 'S3 service exists',
        test: () => fileExists('apps/api/src/services/s3.service.ts'),
        required: true,
      },
      {
        name: 'Artifact repository exists',
        test: () => fileExists('apps/api/src/repositories/pg-artifact.repository.ts'),
        required: true,
      },
      {
        name: 'Tools route exists',
        test: () => fileExists('apps/api/src/routes/tools/index.ts'),
        required: true,
      },
      {
        name: 'Custom HTTP tool exists',
        test: () => fileExists('apps/worker/src/tools/custom/http.ts'),
        required: true,
      },
    ],
  },
  4: {
    name: 'Sprint 4: OAuth',
    checks: [
      {
        name: 'OAuth service exists',
        test: () => fileExists('apps/api/src/services/oauth.service.ts'),
        required: true,
      },
    ],
  },
}

function runAcceptanceCheck(sprintNumber: number) {
  const criteria = sprintCriteria[sprintNumber]

  if (!criteria) {
    console.error(`Unknown sprint: ${sprintNumber}`)
    console.log('Available sprints: 0, 1, 2, 3, 4')
    process.exit(1)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${criteria.name}`)
  console.log(`${'='.repeat(50)}\n`)

  let passed = 0
  let failed = 0

  for (const check of criteria.checks) {
    process.stdout.write(`  Checking: ${check.name}... `)
    const result = check.test()
    const status = result ? '✅' : (check.required ? '❌' : '⚠️')
    console.log(status)

    if (result) {
      passed++
    } else {
      failed++
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(50)}\n`)

  if (failed > 0) {
    console.log('❌ Sprint acceptance criteria NOT met')
    process.exit(1)
  } else {
    console.log('✅ Sprint acceptance criteria MET - Ready for next sprint!')
    process.exit(0)
  }
}

// Main
const sprintArg = process.argv[2]
if (!sprintArg) {
  console.log('Usage: npx tsx scripts/acceptance-check.ts <sprint-number>')
  console.log('Available sprints: 0, 1, 2, 3, 4')
  process.exit(1)
}

runAcceptanceCheck(parseInt(sprintArg, 10))
```

**Step 2: Commit**

```bash
git add scripts/acceptance-check.ts
git commit -m "feat: add sprint acceptance check script"
```

---

## Task 6: Acceptance Shell Script

**Files:**
- Create: `scripts/acceptance.sh`

**Step 1: Create acceptance shell script**

```bash
#!/bin/bash
# scripts/acceptance.sh
# Automated acceptance test runner

set -e

echo "======================================"
echo "  Desk Agent Automated Acceptance"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

run_step() {
  local name=$1
  shift
  local cmd=("$@")

  echo -e "\n${YELLOW}[STEP] $name${NC}"
  if "${cmd[@]}"; then
    echo -e "${GREEN}[PASS] $name${NC}"
  else
    echo -e "${RED}[FAIL] $name${NC}"
    FAILURES=$((FAILURES + 1))
  fi
}

# Step 1: Build Check
run_step "Build All Packages" pnpm build

# Step 2: TypeScript Check
run_step "TypeScript Check" pnpm -r tsc --noEmit

# Step 3: Start Test Databases
echo -e "\n${YELLOW}[STEP] Starting Test Databases${NC}"
docker compose -f docker-compose.test.yml up -d
sleep 5  # Wait for services

# Step 4: Unit/Integration Tests
run_step "Unit & Integration Tests" pnpm test

# Step 5: E2E Tests (if web exists)
if [ -d "apps/web" ]; then
  run_step "E2E Tests" pnpm --filter @desk-agent/web test:e2e
fi

# Step 6: Stop Test Databases
echo -e "\n${YELLOW}[STEP] Stopping Test Databases${NC}"
docker compose -f docker-compose.test.yml down -v

# Summary
echo ""
echo "======================================"
if [ $FAILURES -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC}"
  echo "======================================"
  exit 0
else
  echo -e "  ${RED}$FAILURES CHECK(S) FAILED${NC}"
  echo "======================================"
  exit 1
fi
```

**Step 2: Make script executable**

Run: `chmod +x scripts/acceptance.sh`

**Step 3: Commit**

```bash
git add scripts/acceptance.sh
git commit -m "feat: add automated acceptance runner script"
```

---

## Task 7: GitHub Actions CI

**Files:**
- Create: `.github/workflows/test.yml`

**Step 1: Create GitHub Actions workflow**

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: desk_agent_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5433/desk_agent_test
          REDIS_URL: redis://localhost:6380
          JWT_SECRET: test-jwt-secret

      - name: Install Playwright
        run: pnpm --filter @desk-agent/web playwright install chromium
        if: hashFiles('apps/web/package.json') != ''
        continue-on-error: true

      - name: Run E2E tests
        run: pnpm --filter @desk-agent/web test:e2e
        if: hashFiles('apps/web/e2e') != ''
        continue-on-error: true
        env:
          DATABASE_URL: postgresql://test:test@localhost:5433/desk_agent_test
          REDIS_URL: redis://localhost:6380
          JWT_SECRET: test-jwt-secret
```

**Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions test workflow"
```

---

## Verification Checklist

After completing Sprint 0:

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` passes
- [ ] `pnpm test` runs and passes
- [ ] `docker compose -f docker-compose.test.yml up -d` starts databases
- [ ] `npx tsx scripts/acceptance-check.ts 0` passes

## How to Use

### During Development

```bash
# Run tests continuously
pnpm test:watch

# Check specific sprint acceptance
npx tsx scripts/acceptance-check.ts 1
```

### Before Marking Sprint Complete

```bash
# Full acceptance run
./scripts/acceptance.sh

# Sprint-specific check
npx tsx scripts/acceptance-check.ts <sprint-number>
```

### In CI

The GitHub Actions workflow runs automatically on push/PR.

---

## Next Steps

After Sprint 0 completion:
1. Run `npx tsx scripts/acceptance-check.ts 0` to verify
2. Proceed to Sprint 1 (Web Frontend)
3. Each task should include tests
4. Run acceptance check after each sprint
