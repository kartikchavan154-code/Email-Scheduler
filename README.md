# ReachInbox — Production-Grade Email Scheduler & Worker Service

A high-throughput, fault-tolerant email scheduling platform inspired by ReachInbox. Built with a distributed queue architecture using **BullMQ**, **Redis**, **PostgreSQL**, **Elasticsearch**, **Nodemailer (Ethereal)**, and **Slack Block Kit** notifications.

---

## 🏗️ Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client & Frontend"]
        UI["React 18 + Vite + Tailwind CSS Dashboard"]
        FigmaRef["ReachInbox Design System & Component Layout"]
    end

    subgraph Ingestion ["Ingestion & API Layer"]
        API["Express.js + TypeScript REST API"]
        AuthMiddleware["JWT Session + Google OAuth 2.0 Engine"]
        Parser["CSV / TXT Recipient Stream Parser"]
        BullBoard["Bull Board Admin Monitor (/admin/queues)"]
    end

    subgraph Persistence ["Persistence & Indexing Layer"]
        PostgreSQL[("PostgreSQL\n(Prisma ORM - Source of Truth)")]
        RedisStore[("Redis 7 (AOF Persistent)\nAtomic Rate Limits & BullMQ Storage")]
        Elasticsearch[("Elasticsearch 8\nFull-text Search & Tenant Isolation")]
    end

    subgraph Workers ["Distributed Worker Engine"]
        WorkerCluster["BullMQ Worker Cluster (Configurable Concurrency)"]
        RateLimiter["Redis Lua-backed Distributed Rate Limiter & Throttle"]
        SmtpEngine["Nodemailer Ethereal SMTP Engine"]
        SlackDispatcher["Slack Web API OAuth v2 & Block Kit Dispatcher"]
        Reconciliation["Startup Crash Recovery & Reconciliation Service"]
    end

    UI -->|HTTP / REST + Cookies| API
    API -->|Authenticate| AuthMiddleware
    API -->|Parse Leads| Parser
    API -->|Persist Batch & Records| PostgreSQL
    API -->|Index Scheduled| Elasticsearch
    API -->|Enqueue Persistent Delayed Jobs| RedisStore
    
    Reconciliation -.->|Startup Only: Verify Stale Records| PostgreSQL
    Reconciliation -.->|Re-enqueue Missing Jobs Without Duplication| RedisStore

    WorkerCluster -->|Fetch Due Delayed Jobs| RedisStore
    WorkerCluster -->|Atomic Slot Check via Lua| RateLimiter
    RateLimiter -->|Check Hourly Ceiling & Min Delay| RedisStore
    
    RateLimiter -->|Rate Limit Transition Hit| SlackDispatcher
    SlackDispatcher -->|Post Block Kit Alert| SlackChannel["Connected Slack Workspace"]

    WorkerCluster -->|Deliver Mail| SmtpEngine
    SmtpEngine -->|Send SMTP| Ethereal["Ethereal Email Server"]
    
    WorkerCluster -->|Update Status: SENT / FAILED| PostgreSQL
    WorkerCluster -->|Update Document State| Elasticsearch
    BullBoard -->|Live Job Metrics| RedisStore
```

---

## 🧰 Technology Stack

### Backend
- **Runtime & Language:** Node.js v22+ with TypeScript
- **Web Framework:** Express.js 4.x
- **Queue & Scheduling:** BullMQ 5.x (backed by persistent Redis delayed jobs)
- **Cache & Rate Limiting:** Redis 7 with atomic Lua scripts
- **Database & ORM:** PostgreSQL 16 with Prisma ORM 5.x
- **Search Engine:** Elasticsearch 8.x with fuzzy multi-match querying
- **Email Transport:** Nodemailer with Ethereal Email test accounts
- **Authentication:** Google OAuth 2.0 + Secure HTTP-only JWT Sessions
- **Team Alerts:** Slack OAuth v2 & Block Kit interactive webhooks
- **Observability:** Bull Board for real-time queue diagnostics & Pino structured logging

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS with modern dark mode aesthetic
- **Icons & UI:** Lucide React, Glassmorphism panels, and reactive toasts
- **Forms & Validation:** React Hook Form + Zod schema validation
- **Routing:** React Router v7

---

## ⚙️ Prerequisites

1. **Node.js**: v20 or v22 installed (`node -v`)
2. **PowerShell**: Windows PowerShell or PowerShell 7 (use `npm.cmd` and `npx.cmd`)
3. **Docker & Docker Compose**: Optional for containerized deployment, or native local services:
   - PostgreSQL running on port `5432`
   - Redis running on port `6379`
   - Elasticsearch running on port `9200`

---

## 🚀 Quick Start Guide (Windows PowerShell)

### 1. Clone & Enter Directory
```powershell
git clone <repo-url>
cd assgnment
```

### 2. Environment Configuration
Copy `.env.example` to `backend/.env`:
```powershell
Copy-Item backend/.env.example backend/.env
```

Review key configurations in `backend/.env`:
```env
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox?schema=public
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_NODE=http://localhost:9200
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

### 3. Docker Infrastructure (Recommended)
Launch PostgreSQL, Redis, and Elasticsearch with persistent volumes:
```powershell
docker-compose up -d postgres redis elasticsearch
```

### 4. Database Setup & Migrations
```powershell
cd backend
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma db push
```

### 5. Launch Backend API & Worker
In Terminal 1 (API Server):
```powershell
cd backend
npm.cmd run dev
```

In Terminal 2 (BullMQ Standalone Worker Process):
```powershell
cd backend
npm.cmd run worker:dev
```
*(Note: If running in unified single-process mode, the API server automatically runs the worker if `RUN_STANDALONE_WORKER` is false).*

### 6. Launch Frontend UI
In Terminal 3 (React Client):
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🛡️ Key Architectural Requirements & Deep-Dive

### 1. Persistence & Restart Recovery
* **Redis Persistence**: Configured with `appendonly yes` (AOF) and periodic RDB snapshots.
* **Deterministic Job IDs**: Every email record receives a deterministic BullMQ job ID: `email_${email.id}`.
* **Startup Reconciliation Service (`ReconciliationService.reconcileOnStartup`)**:
  - Runs **once** at server boot.
  - Recovers records stuck in `PROCESSING` if a previous worker died mid-flight.
  - Queries all `SCHEDULED` emails in PostgreSQL.
  - Checks BullMQ queue status. If a job is active, waiting, or delayed in BullMQ, it is **left untouched** (no duplicates).
  - If missing from BullMQ, it is re-enqueued with its calculated delay: `delay = Math.max(0, scheduledAt - now)`.
* **At-Least-Once Delivery**: Because SMTP does not support distributed two-phase commits, a crash window exists between SMTP socket write and database status update. The system mitigates this with deterministic IDs, durable state transitions, and idempotency checks before invoking the SMTP transporter.

### 2. Distributed Hourly Rate Limiting (Redis Lua)
* The rate limiter uses a fixed hourly window algorithm: `ratelimit:sender:{senderId}:window:{yyyy-MM-dd-HH}`.
* Enforced via an **atomic Redis Lua script** (`RateLimiterService.reserveSendSlot`):
  1. Checks if elapsed time since `last_send_timestamp` is less than `MIN_DELAY_BETWEEN_SENDS_MS`. If so, returns `MIN_DELAY_VIOLATION`.
  2. Reads the current window counter. If `>= hourlyLimit`, sets a deduplicated notification flag atomically (`SET ... NX EX 7200`) and returns `RATE_LIMITED` with the exact milliseconds remaining until the start of the next hour.
  3. Otherwise, increments the counter with a TTL expiring at the end of the window, updates `last_send_timestamp`, and returns `ALLOWED`.
* **Zero Dropped Emails**: When a sender hits its hourly limit, excess emails are **never failed or discarded**. They are rescheduled to `job.moveToDelayed(nextWindowStartMs)`.

### 3. Concurrency & Minimum Inter-Send Delay
* Concurrency is controlled via `WORKER_CONCURRENCY` (default: 5 concurrent jobs per worker instance).
* If 5 concurrent jobs for the same sender wake up simultaneously, the first job acquires the slot; the remaining 4 receive `MIN_DELAY_VIOLATION` from Redis.
* **No Long Thread Sleeps**: Workers **do not** block thread execution with long sleeps. Instead, jobs are deferred via `job.moveToDelayed(now + delayMs)`.

### 4. Slack OAuth 2.0 & Real Rate-Limit Notifications
* Real OAuth v2 authorization flow saves encrypted Slack tokens (`AES-256-GCM`).
* When a sender hits its hourly quota for the first time in a window, an automated Block Kit notification is dispatched:
  - Sender identity & email address
  - Configured hourly ceiling
  - Current window key (UTC)
  - Next eligible window timestamp
  - Confirmation that remaining emails are safely queued
* Deduplication key prevents Slack notification spam across multiple concurrent worker nodes.

### 5. Elasticsearch Search & Tenant Isolation
* Elasticsearch index `reachinbox_emails` with explicit keyword/text mappings.
* Synchronized on email creation and status updates.
* Multi-field fuzzy search across `recipientEmail`, `subject`, `body`, and `senderName`.
* Every query enforces strict tenant isolation: `filter: [{ term: { userId } }]`.
* Graceful fallback to PostgreSQL indexing if Elasticsearch is temporarily offline.

### 6. Bull Board Queue Monitoring
* Live web UI mounted at `http://localhost:5000/admin/queues`.
* Protected by HTTP Basic Authentication (`BULL_BOARD_USERNAME` / `BULL_BOARD_PASSWORD`).
* Real-time visibility into **Waiting**, **Active**, **Delayed**, **Completed**, and **Failed** jobs.

---

## 📡 API Endpoints Reference

### Authentication
- `GET /api/auth/google`: Initiates Google OAuth 2.0 flow
- `GET /api/auth/google/callback`: OAuth callback, sets secure HTTP-only cookie
- `GET /api/auth/me`: Current authenticated user profile
- `POST /api/auth/logout`: Invalidates session and clears cookie
- `POST /api/auth/dev-login`: Instant developer sign-in for automated test environments

### Email Management
- `POST /api/emails/schedule`: Schedule batch via JSON leads or multipart/form-data CSV upload
- `GET /api/emails/stats`: Aggregated metrics (scheduled, sent, failed, active senders)
- `GET /api/emails/scheduled`: Paginated scheduled queue
- `GET /api/emails/sent`: Paginated sent emails with Ethereal preview links
- `GET /api/emails/failed`: Paginated failed jobs with error diagnostic details
- `GET /api/emails/search`: Elasticsearch search with query, status, and date filters
- `GET /api/emails/:id`: Retrieve single email record
- `POST /api/emails/:id/cancel`: Cancel scheduled delayed job

### Senders & Limits
- `GET /api/senders`: List user's sender identities
- `POST /api/senders`: Create sender (custom SMTP or dynamic test Ethereal account)
- `GET /api/senders/:id/limits`: Live Redis rate-limit window usage and remaining capacity
- `POST /api/senders/:id/verify`: Test real-time SMTP connection

### Slack Integration
- `GET /api/slack/connect`: Initiates Slack OAuth v2 flow
- `GET /api/slack/callback`: Slack authorization callback
- `GET /api/slack/status`: Current connection status & workspace info
- `POST /api/slack/disconnect`: Removes Slack connection
- `POST /api/slack/test-message`: Sends verification test rate-limit alert

### Health & Operations
- `GET /api/health`: Service liveness
- `GET /api/health/ready`: Deep readiness probe checking PostgreSQL, Redis, and Elasticsearch
- `GET /admin/queues`: Bull Board real-time queue inspector

---

## 🧪 Testing Commands

Execute backend automated tests:
```powershell
cd backend
npm.cmd test
```

### High-Volume Load Test (1,000 Emails)
To simulate scheduling 1,000 emails with rate limiting and delay enforcement:
1. Open the ReachInbox Dashboard at `http://localhost:5173`.
2. Click **Compose New Email**.
3. In the Recipients box, upload a CSV with 1,000 leads or paste 1,000 rows.
4. Set **Delay per Email** to `2` seconds and **Hourly Limit** to `200`.
5. Click **Schedule Batch**.
6. Observe:
   - All 1,000 emails are persisted in PostgreSQL in bulk.
   - Initial 200 jobs are dispatched across the first hour at 2-second intervals.
   - The 201st email triggers the **Slack rate limit notification** and is automatically deferred to the start of the next hour.
   - Bull Board (`/admin/queues`) visualizes the delayed jobs transitioning to active in real-time!

---

## 📽️ Demo Video Checklist (5-Minute Walkthrough)

- [ ] **0:00 - 0:45**: Architecture overview (BullMQ, Redis, PostgreSQL, Elasticsearch).
- [ ] **0:45 - 1:30**: User login via Google OAuth (or instant demo workspace).
- [ ] **1:30 - 2:30**: Compose modal, CSV upload, lead parser validation, setting delay (2s) & hourly limit.
- [ ] **2:30 - 3:15**: Ethereal Email sending & opening the live email preview URL.
- [ ] **3:15 - 4:00**: Triggering the hourly rate limit, showing Slack Block Kit alert, and checking Bull Board queue states.
- [ ] **4:00 - 4:45**: Restart resilience demo: scheduling future email, terminating server, rebooting, and verifying recovery without duplicates.
- [ ] **4:45 - 5:00**: Elasticsearch search demo & wrap-up.
