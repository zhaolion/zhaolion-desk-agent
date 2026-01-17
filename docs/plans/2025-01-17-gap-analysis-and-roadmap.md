# Desk Agent Gap Analysis & Implementation Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Desk Agent system by implementing remaining features from the architecture design.

**Architecture:** Build upon existing Hono API + Worker foundation, add Web Frontend with React, integrate Stripe for payments, S3 for storage, and expand tooling capabilities.

**Tech Stack:** TypeScript, React + Vite, Hono, PostgreSQL + Drizzle, Redis Streams, Claude SDK, Stripe API, AWS S3

---

## Current Progress Summary

### Phase 1: Core (100% Complete)
| Feature | Status | Notes |
|---------|--------|-------|
| Monorepo (pnpm + Turborepo) | ✅ | Working |
| API Server (Hono) | ✅ | apps/api |
| Worker (Claude SDK) | ✅ | apps/worker with agent-loop |
| Redis Streams | ✅ | Task queue + event streaming |
| PostgreSQL + Drizzle | ✅ | Full schema |
| Local file storage | ✅ | storage.service.ts |

### Phase 2: UX (60% Complete)
| Feature | Status | Notes |
|---------|--------|-------|
| SSE Real-time | ✅ | event-subscriber.ts |
| Human-in-loop | ✅ | In worker |
| Webhooks | ✅ | With HMAC signing |
| **Web Frontend** | ❌ | Not started |

### Phase 3: Commercial (40% Complete)
| Feature | Status | Notes |
|---------|--------|-------|
| Users + Auth (JWT) | ✅ | Working |
| API Keys | ✅ | Full CRUD |
| Teams | ✅ | With role-based access |
| Billing DB Models | ✅ | plans, subscriptions, usage, invoices |
| **Stripe Integration** | ❌ | Only DB models |
| **S3 Storage** | ❌ | Not started |
| **OAuth Providers** | ❌ | Not started |

### Phase 4: Scale (10% Complete)
| Feature | Status | Notes |
|---------|--------|-------|
| Teams collaboration | ✅ | Basic |
| **Multi-worker** | ❌ | Single worker |
| **Custom tools registry** | ❌ | Only builtin |
| **Monitoring** | ❌ | Not started |

---

## Gap Analysis

### Priority 1: Web Frontend (Critical for UX)
- **Gap:** No user interface exists
- **Impact:** Users cannot interact with the system without API knowledge
- **Effort:** Large (new app)

### Priority 2: Stripe Integration (Critical for Commercial)
- **Gap:** DB models exist but no actual payment processing
- **Impact:** Cannot monetize the service
- **Effort:** Medium

### Priority 3: S3 Storage (Important for Scale)
- **Gap:** Only local storage, no cloud sync
- **Impact:** Logs/artifacts lost if worker restarts
- **Effort:** Medium

### Priority 4: Custom Tools (Important for Flexibility)
- **Gap:** Users cannot extend agent capabilities
- **Impact:** Limited use cases
- **Effort:** Medium

### Priority 5: OAuth Providers (Nice to have)
- **Gap:** Only email/password auth
- **Impact:** Reduced sign-up conversion
- **Effort:** Small

---

## Implementation Roadmap

## Epic 1: Web Frontend Foundation

> **Epic Goal:** Create a functional web dashboard where users can manage agents, tasks, and view execution results.

### User Story 1.1: Authentication Pages
**As a** user
**I want to** sign up and log in to the dashboard
**So that** I can access my agents and tasks

**Acceptance Criteria:**
- [ ] Login page with email/password
- [ ] Registration page with email/password
- [ ] JWT token stored in localStorage/cookies
- [ ] Redirect to dashboard after login
- [ ] Error handling for invalid credentials

**Files:**
- Create: `apps/web/` (new Vite + React project)
- Create: `apps/web/src/pages/Login.tsx`
- Create: `apps/web/src/pages/Register.tsx`
- Create: `apps/web/src/hooks/useAuth.ts`
- Create: `apps/web/src/contexts/AuthContext.tsx`

---

### User Story 1.2: Dashboard Layout
**As a** user
**I want to** see a navigation sidebar and main content area
**So that** I can easily navigate between different sections

**Acceptance Criteria:**
- [ ] Sidebar with navigation links (Dashboard, Agents, Tasks, Settings)
- [ ] Header with user menu (profile, logout)
- [ ] Protected routes (redirect to login if not authenticated)
- [ ] Responsive design for mobile

**Files:**
- Create: `apps/web/src/layouts/DashboardLayout.tsx`
- Create: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/components/Header.tsx`
- Create: `apps/web/src/pages/Dashboard.tsx`

---

### User Story 1.3: Agents Management
**As a** user
**I want to** create, view, edit, and delete agents
**So that** I can configure AI agents for different tasks

**Acceptance Criteria:**
- [ ] List all agents with name, model, created date
- [ ] Create agent form (name, description, model, system prompt)
- [ ] Edit agent configuration
- [ ] Delete agent with confirmation
- [ ] Show agent's associated tasks

**Files:**
- Create: `apps/web/src/pages/Agents.tsx`
- Create: `apps/web/src/pages/AgentDetail.tsx`
- Create: `apps/web/src/components/AgentForm.tsx`
- Create: `apps/web/src/api/agents.ts`

---

### User Story 1.4: Tasks Management
**As a** user
**I want to** create and manage task templates
**So that** I can define reusable prompts for my agents

**Acceptance Criteria:**
- [ ] List all tasks with name, agent, last run
- [ ] Create task form (name, description, prompt, variables)
- [ ] Edit task configuration
- [ ] Delete task with confirmation
- [ ] Quick "Run Now" button

**Files:**
- Create: `apps/web/src/pages/Tasks.tsx`
- Create: `apps/web/src/pages/TaskDetail.tsx`
- Create: `apps/web/src/components/TaskForm.tsx`
- Create: `apps/web/src/api/tasks.ts`

---

### User Story 1.5: Task Run Viewer
**As a** user
**I want to** see real-time execution progress of my tasks
**So that** I can monitor what the agent is doing

**Acceptance Criteria:**
- [ ] SSE connection for live updates
- [ ] Show current step and status
- [ ] Display logs in real-time
- [ ] Show artifacts when complete
- [ ] Human input form when waiting

**Files:**
- Create: `apps/web/src/pages/TaskRun.tsx`
- Create: `apps/web/src/components/LogViewer.tsx`
- Create: `apps/web/src/components/HumanInputForm.tsx`
- Create: `apps/web/src/hooks/useSSE.ts`
- Create: `apps/web/src/api/runs.ts`

---

## Epic 2: Stripe Payment Integration

> **Epic Goal:** Enable subscription-based billing with Stripe for monetization.

### User Story 2.1: Stripe Customer Setup
**As a** system
**I want to** create a Stripe customer when a user registers
**So that** billing information is tracked in Stripe

**Acceptance Criteria:**
- [ ] Create Stripe customer on user registration
- [ ] Store stripe_customer_id in users table
- [ ] Handle errors gracefully

**Files:**
- Modify: `apps/api/src/db/schema.ts` (add stripe_customer_id to users)
- Create: `apps/api/src/services/stripe.service.ts`
- Modify: `apps/api/src/routes/auth/index.ts` (create customer on register)

---

### User Story 2.2: Subscription Checkout
**As a** user
**I want to** subscribe to a plan using Stripe Checkout
**So that** I can upgrade my account

**Acceptance Criteria:**
- [ ] View available plans with prices
- [ ] Create Stripe Checkout session
- [ ] Redirect to Stripe payment page
- [ ] Handle success/cancel redirects
- [ ] Update subscription in database

**Files:**
- Modify: `apps/api/src/routes/billing/index.ts` (add checkout endpoint)
- Create: `apps/web/src/pages/Billing.tsx`
- Create: `apps/web/src/pages/BillingSuccess.tsx`
- Modify: `apps/api/src/services/stripe.service.ts`

---

### User Story 2.3: Webhook Handling
**As a** system
**I want to** handle Stripe webhooks
**So that** subscription changes are synced to our database

**Acceptance Criteria:**
- [ ] Endpoint for Stripe webhooks
- [ ] Verify webhook signatures
- [ ] Handle subscription.created/updated/deleted
- [ ] Handle invoice.paid/payment_failed
- [ ] Update local database accordingly

**Files:**
- Create: `apps/api/src/routes/stripe-webhook/index.ts`
- Modify: `apps/api/src/services/stripe.service.ts`
- Modify: `apps/api/src/main.ts` (add webhook route)

---

### User Story 2.4: Usage Metering
**As a** system
**I want to** track API usage and token consumption
**So that** users can be billed based on usage

**Acceptance Criteria:**
- [ ] Record tokens used per task run
- [ ] Aggregate usage by billing period
- [ ] Report usage to Stripe (metered billing)
- [ ] Show usage in dashboard

**Files:**
- Create: `apps/api/src/services/metering.service.ts`
- Modify: `apps/worker/src/claude/agent-loop.ts` (report usage)
- Create: `apps/web/src/pages/Usage.tsx`

---

## Epic 3: S3 Storage Integration

> **Epic Goal:** Sync logs and artifacts to S3 for durability and scalability.

### User Story 3.1: S3 Service Implementation
**As a** system
**I want to** upload files to S3
**So that** artifacts persist beyond worker lifecycle

**Acceptance Criteria:**
- [ ] S3 client configuration
- [ ] Upload file to S3 with key
- [ ] Generate presigned URLs for downloads
- [ ] Handle errors and retries

**Files:**
- Create: `packages/domain/src/storage/service/s3.service.ts`
- Create: `apps/api/src/services/s3.service.ts` (implementation)
- Modify: `apps/api/src/config.ts` (add S3 config)

---

### User Story 3.2: Artifact Sync
**As a** system
**I want to** automatically sync artifacts to S3 when task completes
**So that** users can download them later

**Acceptance Criteria:**
- [ ] Upload artifacts on task completion
- [ ] Store S3 key in artifacts table
- [ ] API endpoint to get presigned download URL
- [ ] Clean up local files after sync

**Files:**
- Create: `apps/api/src/repositories/pg-artifact.repository.ts`
- Modify: `apps/api/src/services/storage.service.ts`
- Modify: `apps/api/src/routes/tasks/runs.ts` (add artifact download)

---

### User Story 3.3: Log Collector
**As a** system
**I want to** periodically sync logs to S3
**So that** logs are preserved and local disk is freed

**Acceptance Criteria:**
- [ ] Scheduled job to find completed runs
- [ ] Upload logs to S3
- [ ] Update log_files table with s3_key
- [ ] Delete local logs after sync

**Files:**
- Create: `apps/worker/src/collector/log-collector.ts`
- Create: `apps/api/src/repositories/pg-logfile.repository.ts`
- Modify: `apps/worker/src/main.ts` (start collector)

---

## Epic 4: Custom Tools Registry

> **Epic Goal:** Allow users to define custom tools for their agents.

### User Story 4.1: Tools Table & API
**As a** user
**I want to** register custom tools
**So that** my agents can use them

**Acceptance Criteria:**
- [ ] Tools table in database
- [ ] CRUD API for tools
- [ ] Tool definition schema (name, description, inputSchema)
- [ ] Associate tools with agents

**Files:**
- Modify: `apps/api/src/db/schema.ts` (add tools table)
- Create: `packages/domain/src/agent/entity/tool.ts`
- Create: `packages/domain/src/agent/repository/tool.repository.ts`
- Create: `apps/api/src/repositories/pg-tool.repository.ts`
- Create: `apps/api/src/routes/tools/index.ts`

---

### User Story 4.2: HTTP Tool Type
**As a** user
**I want to** create tools that call external HTTP APIs
**So that** my agent can integrate with external services

**Acceptance Criteria:**
- [ ] HTTP tool definition (method, url, headers, body template)
- [ ] Execute HTTP requests in worker
- [ ] Variable substitution in URL/body
- [ ] Handle authentication headers

**Files:**
- Create: `apps/worker/src/tools/custom/http.ts`
- Modify: `apps/worker/src/tools/registry.ts`
- Create: `apps/web/src/components/ToolForm.tsx`

---

### User Story 4.3: Tools Management UI
**As a** user
**I want to** manage tools in the web dashboard
**So that** I can create and configure custom tools

**Acceptance Criteria:**
- [ ] List all tools
- [ ] Create tool form with JSON schema editor
- [ ] Edit/delete tools
- [ ] Test tool execution

**Files:**
- Create: `apps/web/src/pages/Tools.tsx`
- Create: `apps/web/src/pages/ToolDetail.tsx`
- Create: `apps/web/src/api/tools.ts`

---

## Epic 5: OAuth Integration

> **Epic Goal:** Allow users to sign in with Google and GitHub.

### User Story 5.1: OAuth Routes
**As a** user
**I want to** sign in with Google or GitHub
**So that** I don't need to remember another password

**Acceptance Criteria:**
- [ ] OAuth redirect endpoint
- [ ] OAuth callback endpoint
- [ ] Create user if not exists
- [ ] Link OAuth to existing account
- [ ] Return JWT on success

**Files:**
- Modify: `apps/api/src/routes/auth/index.ts`
- Create: `apps/api/src/services/oauth.service.ts`
- Modify: `apps/api/src/db/schema.ts` (ensure oauth fields)

---

### User Story 5.2: OAuth UI
**As a** user
**I want to** click "Sign in with Google/GitHub" buttons
**So that** I can quickly authenticate

**Acceptance Criteria:**
- [ ] OAuth buttons on login/register pages
- [ ] Handle OAuth redirects
- [ ] Show loading during OAuth flow
- [ ] Handle errors

**Files:**
- Modify: `apps/web/src/pages/Login.tsx`
- Modify: `apps/web/src/pages/Register.tsx`

---

## Implementation Priority

### Sprint 1: Web Frontend Foundation (Epic 1)
**Focus:** Get a working dashboard
- Story 1.1: Auth pages
- Story 1.2: Dashboard layout
- Story 1.3: Agents management
- Story 1.4: Tasks management
- Story 1.5: Task run viewer

### Sprint 2: Payments (Epic 2)
**Focus:** Enable monetization
- Story 2.1: Stripe customer setup
- Story 2.2: Subscription checkout
- Story 2.3: Webhook handling
- Story 2.4: Usage metering

### Sprint 3: Storage & Tools (Epic 3 + 4)
**Focus:** Durability and extensibility
- Story 3.1: S3 service
- Story 3.2: Artifact sync
- Story 3.3: Log collector
- Story 4.1: Tools table & API
- Story 4.2: HTTP tool type
- Story 4.3: Tools management UI

### Sprint 4: OAuth & Polish (Epic 5)
**Focus:** User convenience
- Story 5.1: OAuth routes
- Story 5.2: OAuth UI
- Bug fixes and improvements

---

## Progress Tracking

### Current Sprint: Not Started
**Next Action:** Begin Sprint 1 - Story 1.1 (Authentication Pages)

| Sprint | Epic | Status | Progress |
|--------|------|--------|----------|
| Sprint 1 | Web Frontend | Not Started | 0/5 stories |
| Sprint 2 | Payments | Not Started | 0/4 stories |
| Sprint 3 | Storage & Tools | Not Started | 0/6 stories |
| Sprint 4 | OAuth | Not Started | 0/2 stories |

**Total Progress:** 0/17 user stories (0%)

---

## Technical Notes

### Web Frontend Tech Stack
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Routing:** React Router v6
- **State:** React Query (TanStack Query)
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui or Radix UI

### API Integration
- All API calls use `fetch` with JWT in Authorization header
- SSE for real-time updates using EventSource
- Error handling with toast notifications

### Stripe Integration
- Use Stripe Checkout for payments (hosted page)
- Stripe Billing for subscriptions
- Webhook signature verification with stripe-signature header

### S3 Integration
- Use AWS SDK v3 (@aws-sdk/client-s3)
- Presigned URLs for client downloads
- Server-side uploads for artifacts
