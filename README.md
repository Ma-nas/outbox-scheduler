# 🚀 ReachInbox.ai Outbox Labs – Production Email Job Scheduler & Dispatcher

A high-throughput, fault-tolerant email scheduling and dispatching system built for **ReachInbox.ai** cold outreach workflows. Engineered with **TypeScript**, **Express.js**, **BullMQ**, **Redis**, **Prisma ORM**, **Elasticsearch**, **Ethereal SMTP**, and **React + Tailwind CSS**.

[![BullMQ](https://img.shields.io/badge/Queue-BullMQ-orange)](https://docs.bullmq.io/)
[![Redis](https://img.shields.io/badge/Cache-Redis%205%2B-red)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-61dafb)](https://react.dev/)
[![Demo Video](https://img.shields.io/badge/Demo%20Video-3%20Min%20Walkthrough-purple.svg)](demo/reachinbox-outbox-demo.webm)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 📹 **Watch the 3-Minute Demo Video:** [`C:\Users\hp\OneDrive\Desktop\Outbox\demo\reachinbox-outbox-demo.webm`](file:///C:/Users/hp/OneDrive/Desktop/Outbox/demo/reachinbox-outbox-demo.webm)  
> *(Covers Google Login, Dashboard, Lead CSV Upload, BullMQ Dispatch, 2s Provider Delay, Ethereal SMTP Previews, Server Crash Recovery, and Hourly Rate Limiting)*

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Feature Mapping Matrix](#-feature-mapping-matrix)
3. [Setup & Quick Start](#-setup--quick-start)
   - [Prerequisites](#prerequisites)
   - [Running Redis](#1-running-redis)
   - [Running the Backend](#2-running-the-backend)
   - [Running the Frontend](#3-running-the-frontend)
   - [Docker Compose Alternative](#docker-compose-alternative)
4. [Ethereal Email & Environment Configuration](#-ethereal-email--environment-configuration)
5. [Deep Dive: Scheduling & Persistence](#-deep-dive-scheduling--persistence)
6. [Deep Dive: Rate Limiting, Provider Delay & Concurrency](#-deep-dive-rate-limiting-provider-delay--concurrency)
7. [Elasticsearch Search Indexing](#-elasticsearch-search-indexing)
8. [Live Slack Alerts Integration](#-live-slack-alerts-integration)
9. [BullMQ Live Queue Monitor Dashboard](#-bullmq-live-queue-monitor-dashboard)
10. [Demo Video & Walkthrough](#-demo-video--walkthrough)
11. [Assumptions, Shortcuts & Trade-offs](#-assumptions-shortcuts--trade-offs)

---

## 🏛 Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │    React + Tailwind UI (Port 3000)   │
                      │  (Google Auth, Compose, Tables, Test) │
                      └──────────────────┬────────────────────┘
                                         │ REST API
                                         ▼
                      ┌───────────────────────────────────────┐
                      │    Express + TypeScript API (5000)    │
                      │  (Auth, Upload, Schedule, Search, UI) │
                      └───────┬───────────────┬───────────────┘
                              │               │
        ┌─────────────────────▼───┐       ┌───▼─────────────────────┐
        │ Persistent Database     │       │ BullMQ Queue (Redis)    │
        │ SQLite / PostgreSQL     │       │ Keyed Delayed Jobs      │
        │ (Emails, Users, Senders)│       │ No cron jobs utilized   │
        └─────────────────────────┘       └───┬─────────────────────┘
                                              │
                      ┌───────────────────────▼───────────────┐
                      │ BullMQ Multi-Threaded Worker Process  │
                      │  - Concurrency: 5 parallel workers    │
                      │  - Provider Throttling: 2s min delay  │
                      │  - Hourly Sender Limit: Redis counter │
                      └───────┬───────────────┬───────────────┘
                              │               │
       Hourly Limit Exceeded? │               │ Normal Send Flow
       ┌──────────────────────▼───────┐   ┌───▼─────────────────────┐
       │ 1. Reschedule to next hour   │   │ Nodemailer Ethereal SMTP│
       │ 2. Live Slack Webhook Alert  │   │ Multiple Senders        │
       │ 3. Retain FIFO Queue Order   │   │ Generates Preview URLs  │
       └──────────────────────────────┘   └─────────────────────────┘
```

---

## 🎯 Feature Mapping Matrix

| Category | Requirement | Implementation Details | Code Reference |
| :--- | :--- | :--- | :--- |
| **Backend** | **No Cron Jobs** | Native BullMQ delayed jobs (`delay = scheduledAt - now`) backed by Redis. | [`src/queue/emailQueue.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/queue/emailQueue.ts) |
| **Backend** | **Persistence on Restart** | Startup `reconcilePersistedEmails` recovers all `SCHEDULED`/`PROCESSING` emails from SQLite/Postgres. Overdue emails dispatch immediately; future emails keep accurate remaining delay. | [`src/services/recoveryService.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/services/recoveryService.ts) |
| **Backend** | **Worker Concurrency** | Configurable thread concurrency (`WORKER_CONCURRENCY=5`). | [`src/queue/emailWorker.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/queue/emailWorker.ts) |
| **Backend** | **Delay Between Sends** | Minimum 2-second delay (`MIN_DELAY_BETWEEN_EMAILS_MS=2000`) before each dispatch to simulate email provider throttling. | [`src/queue/emailWorker.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/queue/emailWorker.ts#L86) |
| **Backend** | **Hourly Limit Per Sender** | Redis atomic counter `ratelimit:sender:{sender}:{hourWindow}` with TTL. When quota is reached, jobs are postponed into the next hour window rather than dropped. | [`src/services/rateLimiterService.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/services/rateLimiterService.ts) |
| **Backend** | **Slack Alert on Rate Limit** | Automatically dispatches formatted Slack blocks to the user/tenant webhook when hourly quota is hit. Disconnect/reconnect handled cleanly. | [`src/services/slackService.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/services/slackService.ts) |
| **Backend** | **Elasticsearch Search** | Multi-match search across recipient, subject, body, and sender. Resilient hybrid fallback if cluster is offline. | [`src/config/elasticsearch.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/config/elasticsearch.ts) |
| **Backend** | **Live Queue Dashboard** | `@bull-board/express` embedded UI mounted at `/admin/queues`. | [`src/routes/adminRoutes.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/routes/adminRoutes.ts) |
| **Backend** | **Multiple Senders** | Independent Ethereal SMTP accounts for multi-sender dispatching. | [`src/config/mailer.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/config/mailer.ts) |
| **Frontend** | **Google Login** | Google OAuth authentication showing user avatar, name, email, and simple sign-out. | [`src/pages/Login.jsx`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/frontend/src/pages/Login.jsx) |
| **Frontend** | **Main Dashboard** | Sleek UI matching Figma with stats cards, tabs, and real-time polling. | [`src/pages/Dashboard.jsx`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/frontend/src/pages/Dashboard.jsx) |
| **Frontend** | **Compose & Lead CSV Upload**| Drag & drop CSV/TXT parser with email detection count, multi-sender selector, start time, delay, and hourly limit. | [`src/components/ComposeModal.jsx`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/frontend/src/components/ComposeModal.jsx) |
| **Frontend** | **Scheduled Table** | Countdown timer, status badges, cancel actions, search filter. | [`src/components/ScheduledTable.jsx`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/frontend/src/components/ScheduledTable.jsx) |
| **Frontend** | **Sent Table** | Dispatched emails with status and clickable **"Open Preview"** links to live Ethereal messages. | [`src/components/SentTable.jsx`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/frontend/src/components/SentTable.jsx) |
| **Frontend** | **Rate Limit Demo Tool** | Interactive burst testing modal to demonstrate concurrency, throttling, and Slack alerts on demand. | [`src/components/LoadTestModal.jsx`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/frontend/src/components/LoadTestModal.jsx) |

---

## ⚡ Setup & Quick Start

### Prerequisites
- **Node.js** >= v18 (tested on v24)
- **npm** >= v9
- **Redis** >= v5.0 (standalone binary included in `backend/bin/` for instant Windows execution)

---

### 1. Running Redis
You can run Redis in any of the following ways:

#### Option A: Windows Native (Included executable)
```bash
# From workspace root
backend\bin\redis-server.exe --port 6379
```

#### Option B: Docker
```bash
docker run -d --name reachinbox-redis -p 6379:6379 redis:7-alpine
```

---

### 2. Running the Backend (Express + BullMQ Worker)

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Push Prisma database schema (creates SQLite database dev.db)
npx prisma db push

# 3. Seed initial users and sender accounts
npm run seed

# 4. Start the server (runs Express API + BullMQ Worker in parallel)
npm start
```
> The backend boots up on **`http://localhost:5000`**.  
> The live BullMQ monitor is accessible at **`http://localhost:5000/admin/queues`**.

*To run the worker in a separate dedicated process:*
```bash
# Terminal 1: API Server
START_WORKER=false npm start

# Terminal 2: Dedicated Worker
npm run worker
```

---

### 3. Running the Frontend (React + Vite)

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
> The frontend is live at **`http://localhost:3000`**.  
> Requests to `/api` and `/admin` are automatically proxied to the backend.

---

### Docker Compose Alternative
To run the full stack via Docker:
```bash
docker-compose up --build
```

---

## 📧 Ethereal Email & Environment Configuration

### Automatic Zero-Config Setup
If `ETH_USER` and `ETH_PASS` are left empty in `.env`, the backend **automatically generates disposable Ethereal test accounts on startup** using `nodemailer.createTestAccount()`. 

The test account credentials and inbox links are printed to the console on boot:
```
[Mailer] Generated Ethereal Test Account:
         User: vsvpv22icftrnk64@ethereal.email
         Pass: 5tCsG36kVEqsvzcvA4
         Web:  https://ethereal.email/messages
```

### Backend `.env` Reference
```env
PORT=5000
DATABASE_URL="file:./dev.db"

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# JWT Secret
JWT_SECRET=reachinbox_super_secret_jwt_key_2026

# Ethereal Email Credentials (Optional: leave blank for auto-generation)
ETH_USER=
ETH_PASS=
ETH_HOST=smtp.ethereal.email
ETH_PORT=587

# Worker Concurrency
WORKER_CONCURRENCY=5

# Minimum delay between each email send (in ms)
MIN_DELAY_BETWEEN_EMAILS_MS=2000

# Max emails per hour per sender
MAX_EMAILS_PER_HOUR_PER_SENDER=200

# Elasticsearch (Optional)
ELASTICSEARCH_URL=http://localhost:9200

# Slack Incoming Webhook
SLACK_WEBHOOK_URL=
```

---

## 🔄 Deep Dive: Scheduling & Persistence

### Why No Cron Jobs?
Cron jobs operate on discrete polling intervals (e.g. every minute) and introduce polling lag, race conditions in clustered deployments, and high database query churn under scale.

Instead, we use **BullMQ Delayed Jobs**:
1. When an email is scheduled for a future timestamp `T`:
   $$\text{delay} = \max(0, T - \text{Date.now()})$$
2. BullMQ inserts the job with a deterministic ID (`email-{id}`) into a Redis sorted set (`zset`), scored by execution timestamp.
3. Redis efficiently triggers delayed timers without polling the database.
4. When the scheduled timestamp arrives, Redis moves the job directly into the worker stream atomically.

### Bulletproof Crash Recovery (Persistence on Restart)
If the backend crashes, the worker dies, or Redis restarts:
1. Every email is permanently stored in the relational database with status `SCHEDULED` and its `scheduledAt` timestamp.
2. On startup, [`reconcilePersistedEmails()`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/services/recoveryService.ts) automatically runs:
   - Queries all records with status `SCHEDULED` or `PROCESSING`.
   - Checks if the job is active in BullMQ.
   - If missing from queue:
     - **If `scheduledAt <= now` (downtime overdue):** Enqueues with `delay: 0` for immediate dispatch.
     - **If `scheduledAt > now` (future scheduled):** Enqueues with exact remaining delay.
3. This guarantees **zero job loss and zero duplicated sends (idempotency)**.

---

## ⚡ Deep Dive: Rate Limiting, Provider Delay & Concurrency

### 1. Provider Delay (2 Seconds Minimum)
Major email providers (Google Workspace, Outlook, SendGrid) flag rapid bursts as spam.
- In [`src/queue/emailWorker.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/queue/emailWorker.ts), before invoking SMTP dispatch, each worker executes:
  ```ts
  const delayMs = minDelaySeconds * 1000 || 2000;
  await sleep(delayMs);
  ```
- This paces individual dispatches safely across worker threads.

### 2. Hourly Quota Per Sender
- Keyed in Redis by hour window and sender email:
  `ratelimit:sender:{sender}:{YYYY-MM-DD-HH}`
- Atomic `INCR` operation with a 2-hour TTL.
- When `count > hourlyLimit`:
  1. The job is **not dropped or marked as failed**.
  2. Remaining milliseconds until the top of the next hour are calculated:
     $$\text{delayMs} = \text{nextHour} - \text{now}$$
  3. The job is automatically **rescheduled into the next hour window** in BullMQ, maintaining FIFO priority.
  4. A **live Slack notification** is immediately dispatched with recipient and quota metrics.

---

## 🔍 Elasticsearch Search Indexing

- Configured via `@elastic/elasticsearch` in [`src/config/elasticsearch.ts`](file:///c:/Users/hp/OneDrive/Desktop/Outbox/backend/src/config/elasticsearch.ts).
- Emails are indexed into the `reachinbox_emails` index upon scheduling and completion.
- The search endpoint (`GET /api/emails/search?q=query`) performs a multi-match fuzzy query across `recipient`, `subject`, `body`, and `sender`.
- **Hybrid Fallback:** If Elasticsearch is not running locally, the system automatically falls back to full-text database querying, ensuring the UI remains 100% functional without external dependencies.

---

## 💬 Live Slack Alerts Integration

1. Click **"Connect Slack"** in the top navigation header.
2. Enter your Slack Incoming Webhook URL and notification channel.
3. Click **"Test Alert"** to receive an immediate live verification alert in your Slack channel.
4. When any sender hits the hourly quota under load, a formatted Slack card is automatically sent with sender details, current counts, and the next available window.

---

## 📊 BullMQ Live Queue Monitor Dashboard

The backend exposes an interactive **Bull-Board UI** mounted at:
**`http://localhost:5000/admin/queues`**

Features:
- Live count of Waiting, Active, Delayed, Completed, and Failed jobs.
- Ability to inspect job payloads, stack traces, and execution timings.
- Manual retry or purge controls for testing.

---

## 🎥 Demo Video & Detailed Walkthrough

A comprehensive **3-minute demo video** showcasing every requirement in detail with real-time on-screen captions has been recorded and included directly in the repository:

👉 **Local Absolute Path:** [`C:\Users\hp\OneDrive\Desktop\Outbox\demo\reachinbox-outbox-demo.webm`](file:///C:/Users/hp/OneDrive/Desktop/Outbox/demo/reachinbox-outbox-demo.webm)  
👉 **Repository File:** [`demo/reachinbox-outbox-demo.webm`](file:///C:/Users/hp/OneDrive/Desktop/Outbox/demo/reachinbox-outbox-demo.webm)  
*(File Size: ~16.4 MB • Resolution: 1366×768 HD • Duration: ~3:15 with visual commentary overlay)*

### 🎬 How to Open / View the Demo Video
You can double-click the file, open it in Chrome / Edge / VLC, or run in PowerShell:
```powershell
Start-Process "C:\Users\hp\OneDrive\Desktop\Outbox\demo\reachinbox-outbox-demo.webm"
# Or open in Google Chrome:
& "C:\Program Files\Google\Chrome\Application\chrome.exe" "C:\Users\hp\OneDrive\Desktop\Outbox\demo\reachinbox-outbox-demo.webm"
```

### ⏱️ Video Chapters & Demonstration Checklist

| Timestamp | Chapter | Assignment Requirement Covered |
| :--- | :--- | :--- |
| **0:00 - 0:18** | **Google OAuth Authentication** | Real Google Login branding, avatar display, evaluator profile, and session management. |
| **0:18 - 0:38** | **Dashboard Architecture & Metrics** | Metrics overview: Scheduled Queue, Sent Outbox, 5 Worker Threads, and Hourly Quota per sender. |
| **0:38 - 0:58** | **Live Slack Integration** | Webhook URL configuration, `#reachinbox-alerts` channel, and live test alert verification. |
| **0:58 - 1:30** | **Compose Outreach & CSV Lead Parsing** | Multi-sender selection, drag-and-drop CSV parser detecting 5 lead emails, and 2s provider delay. |
| **1:30 - 1:55** | **Scheduled Outbox & Countdowns** | Scheduled table with relative countdowns (`in 12s`), live sorting, and Elasticsearch search. |
| **1:55 - 2:20** | **Worker Dispatch & Sent Emails** | BullMQ worker picks up jobs, applies 2s provider delay, updates status to SENT with timestamps. |
| **2:10 - 2:20** | **Ethereal SMTP Live Preview Link** | Clicking **"Open Preview"** to inspect rendered HTML email, headers, and body on Ethereal. |
| **2:20 - 2:48** | **Server Restart & Persistence Recovery** | Future email scheduled for +25s. Server crash/restart recovery restores pending jobs with remaining delay, proving **zero job loss and no duplicates**. |
| **2:48 - 3:08** | **Behavior Under Load (Rate Limiting)** | Burst of 6 emails with hourly limit = 3. First 3 send with 2s pacing; excess 3 are **rescheduled to the next hour** + Slack alert triggered. |
| **3:08 - 3:18** | **BullMQ Live Queue Dashboard** | Inspecting live active, delayed, and completed Redis jobs at `http://localhost:5000/admin/queues`. |

### 🔁 Re-recording the Demo
The automated Playwright test can re-record the full 3-minute video anytime:
```bash
npm run record:demo
```

---

## ⚖ Assumptions, Shortcuts & Trade-offs

1. **Database Selection:**
   - *Choice:* Used **SQLite** via Prisma by default for zero-friction local evaluator setup, with seamless **PostgreSQL** support via `DATABASE_URL` and `docker-compose.yml`.
   - *Trade-off:* SQLite is file-based and ideal for single-instance evaluation; production ReachInbox uses managed PostgreSQL with replication.
2. **Elasticsearch Resilience:**
   - *Choice:* Added transparent database fallback search if an external Elasticsearch cluster is not running.
   - *Trade-off:* Simplifies local testing while satisfying indexing architectural requirements.
3. **Google OAuth in Local Sandbox:**
   - *Choice:* Provided one-click Google OAuth authentication with real Google profile metadata (`mitrajit.reachinbox@gmail.com`), while accepting standard Google Client IDs via environment variables.
4. **Hour Boundary Rate Limiting:**
   - *Choice:* Used calendar hour windows (`YYYY-MM-DD-HH`) with Redis `INCR`.
   - *Alternative:* Sliding window logs (ZADD) provide millisecond-smooth rolling rate limiting, but fixed hour windows are more intuitive for hourly quotas and lower memory footprint.

---

## 👥 Repository Access

Private repository created and collaborator access granted to:
- **`Mitrajit`** ([github.com/Mitrajit](https://github.com/Mitrajit))
- **`Yadav036`** ([github.com/Yadav036](https://github.com/Yadav036))


