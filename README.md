# durequi

Web-based monitoring and management dashboard for the **dureq** job scheduler. Built with React + TypeScript, it provides real-time visibility into jobs, workflows, batches, queues, and worker nodes.

## Features

- **Real-time Updates** — WebSocket push via Redis Pub/Sub with automatic polling fallback
- **14 Pages** — Dashboard, Jobs, Runs, Nodes, Schedules, Queues, DLQ, Workflows, Batches, Redis Info, Settings (+ detail views)
- **Bulk Operations** — Cancel, retry, delete multiple jobs/workflows/batches by selection or status filter
- **Queue Management** — Pause and resume queue tiers
- **Configurable Polling** — 1s / 2s / 5s / 10s / 30s / Off
- **Theme Support** — Dark, Light, System
- **Read-only Mode** — Hide all action buttons for safe monitoring

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Routing | React Router 7 |
| Server State | TanStack React Query 5 |
| Charts | Recharts 3 |
| Build | Vite 7 |
| Real-time | Native WebSocket |

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` and `/api/ws` to `http://localhost:8080` (dureqd monitor API).

### Build

```bash
npm run build      # TypeScript check + Vite production build
npm run preview    # Preview production build
npm run lint       # ESLint
```

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Stats overview with daily charts |
| `/jobs` | Jobs | Job listing with status filter, pagination, bulk ops |
| `/jobs/:id` | Job Detail | Runs, events, payload, cancel/retry/delete |
| `/runs` | Runs | Execution history across all jobs |
| `/nodes` | Nodes | Worker nodes, pool stats, heartbeat status |
| `/schedules` | Schedules | Cron and interval scheduled jobs |
| `/queues` | Queues | Queue tiers with pause/resume controls |
| `/dlq` | DLQ | Dead letter queue entries |
| `/workflows` | Workflows | Workflow listing with task graph |
| `/workflows/:id` | Workflow Detail | Task states, dependencies, cancel/retry |
| `/batches` | Batches | Batch job listing with progress |
| `/batches/:id` | Batch Detail | Per-item results, cancel/retry |
| `/redis` | Redis Info | Redis server diagnostics |
| `/settings` | Settings | Refresh interval, theme, WebSocket toggle, read-only mode |

## Real-time Architecture

```
Redis Pub/Sub ({prefix}:events)
  → dureqd /api/ws (Hub fan-out)
  → Browser WebSocket
  → queryClient.invalidateQueries()
  → React Query refetches stale queries
```

- **Connected** (green dot): WebSocket live, polling disabled
- **Connecting** (yellow dot): Reconnecting with exponential backoff (1s → 30s)
- **Polling** (gray dot): Fallback to configured refresh interval

The WebSocket toggle in Settings allows disabling real-time updates entirely.

## Project Structure

```
src/
├── api.ts                  # Fetch-based API client, type definitions
├── hooks.ts                # TanStack Query hooks (useJobs, useStats, ...)
├── router.tsx              # Route definitions
├── main.tsx                # Entry point, provider tree
├── util.ts                 # Formatting utilities
├── components/
│   ├── JsonView.tsx        # Collapsible JSON viewer
│   ├── Pagination.tsx      # Reusable pagination controls
│   └── PriorityBadge.tsx   # Priority level badge
├── context/
│   ├── SettingsContext.tsx  # Theme, refresh, read-only, WS toggle
│   └── WebSocketContext.tsx # WS connection + cache invalidation bridge
├── hooks/
│   └── useWebSocket.ts     # WebSocket hook with reconnection
├── layouts/
│   └── RootLayout.tsx      # Sidebar nav + status indicator
└── pages/                  # 14 page components
```

## API Endpoints

All endpoints are served by `dureqd` on port 8080.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stats` | Job counts, active schedules/runs/nodes |
| GET | `/api/stats/daily` | 30-day daily breakdown |
| GET | `/api/jobs` | Paginated job list |
| GET | `/api/jobs/:id` | Job detail |
| POST | `/api/jobs/:id/cancel` | Cancel job |
| POST | `/api/jobs/:id/retry` | Retry job |
| DELETE | `/api/jobs/:id` | Delete job |
| POST | `/api/jobs/bulk/cancel` | Bulk cancel |
| POST | `/api/jobs/bulk/retry` | Bulk retry |
| POST | `/api/jobs/bulk/delete` | Bulk delete |
| GET | `/api/jobs/:id/runs` | Job run history |
| GET | `/api/jobs/:id/events` | Job event audit trail |
| GET | `/api/runs` | Global run history |
| GET | `/api/nodes` | Worker nodes |
| GET | `/api/schedules` | Scheduled jobs |
| GET | `/api/queues` | Queue tiers |
| POST | `/api/queues/:name/pause` | Pause queue |
| POST | `/api/queues/:name/resume` | Resume queue |
| GET | `/api/dlq` | Dead letter queue |
| GET | `/api/workflows` | Workflow list |
| GET | `/api/workflows/:id` | Workflow detail |
| POST | `/api/workflows/bulk/cancel` | Bulk cancel workflows |
| POST | `/api/workflows/bulk/retry` | Bulk retry workflows |
| POST | `/api/workflows/bulk/delete` | Bulk delete workflows |
| GET | `/api/batches` | Batch list |
| GET | `/api/batches/:id` | Batch detail |
| POST | `/api/batches/bulk/cancel` | Bulk cancel batches |
| POST | `/api/batches/bulk/retry` | Bulk retry batches |
| POST | `/api/batches/bulk/delete` | Bulk delete batches |
| GET | `/api/redis/info` | Redis server info |
| GET | `/api/sync-retries` | Retry queue status |
| WS | `/api/ws` | Real-time event stream |
