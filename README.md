# durequi

Web-based monitoring and management dashboard for the **dureq** job scheduler. Built with React + TypeScript, it provides real-time visibility into jobs, workflows, batches, queues, and worker nodes.

Made for dureq v0.2.5.

## Features

- **Real-time Updates** — WebSocket push via Redis Pub/Sub with automatic polling fallback
- **17 Pages** — Dashboard, Jobs, Runs, Nodes, Schedules, Queues, DLQ, Workflows, Batches, Audit, Operations, Search, Redis Info, Settings (+ detail views)
- **Firing Board** — What each schedule has run and what is due next, on one axis of time
- **Run Visualizations** — Runs by node, run durations, retry ladder, state timeline, batch item grid
- **Needs Attention** — Late schedules, silent nodes, dead jobs, DLQ and paused work on the dashboard
- **Unique Keys** — Who holds the key of a job, and whether a retry would be refused
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
| `/` | Dashboard | Stats overview with daily charts, needs attention, next firings, live activity |
| `/jobs` | Jobs | Job listing, filtered by status, task type or tag, with pagination and bulk ops |
| `/jobs/:id` | Job Detail | Schedule, runs and their durations, retry ladder, unique key, audit trail, payload editing, cancel/retry/delete |
| `/runs` | Runs | Execution history across all jobs, runs by node |
| `/nodes` | Nodes | Worker nodes, capacity, heartbeat status, drain, handlers and their versions |
| `/schedules` | Schedules | Firing board, overlap policy, what happens on failure |
| `/queues` | Queues | Queue tiers with pause/resume controls |
| `/dlq` | DLQ | Dead letter queue entries, grouped by error |
| `/workflows` | Workflows | Workflow listing with task graph |
| `/workflows/:id` | Workflow Detail | Task states, dependencies, cancel/retry |
| `/batches` | Batches | Batch job listing with progress |
| `/batches/:id` | Batch Detail | Item grid, per-item results, cancel/retry |
| `/audit` | Audit | State changes of a job over time |
| `/ops` | Operations | Locks, concurrency slots, requeue, aggregation groups |
| `/search` | Search | Payload search, unique key lookup |
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

Events are collected and lead to at most one refetch per query and second.

- **Connected** (green dot): WebSocket live, polling only of what has no events (stats, nodes, schedules, queues, DLQ, active runs)
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
│   ├── charts/             # Firing board, node lanes, run durations, ...
│   ├── ActivityFeed.tsx    # Events as they come in
│   ├── JsonView.tsx        # Collapsible JSON viewer
│   ├── Pagination.tsx      # Reusable pagination controls
│   ├── PriorityBadge.tsx   # Priority level badge
│   ├── RunDrawer.tsx       # Details of a run
│   └── Toasts.tsx          # What came of an action
├── context/
│   ├── SettingsContext.tsx  # Theme, refresh, read-only, WS toggle
│   └── WebSocketContext.tsx # WS connection + cache invalidation bridge
├── hooks/
│   └── useWebSocket.ts     # WebSocket hook with reconnection
├── layouts/
│   └── RootLayout.tsx      # Sidebar nav + status indicator
└── pages/                  # 17 page components
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
| PUT | `/api/jobs/:id/payload` | Update the payload |
| GET | `/api/jobs/:id/progress` | Progress of its active runs |
| GET | `/api/jobs/:id/audit` | Job audit trail |
| GET | `/api/runs` | Active runs |
| POST | `/api/runs/:id/requeue` | Run the job of a run again |
| GET | `/api/history/runs` | Global run history |
| GET | `/api/nodes` | Worker nodes |
| POST / DELETE | `/api/nodes/:id/drain` | Drain / undrain a node |
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
| GET | `/api/search/{jobs,workflows,batches}` | Payload search |
| GET / DELETE | `/api/unique-keys/:key` | Who holds a unique key / free it |
| GET / DELETE | `/api/locks/:key` | Inspect / remove a lock |
| GET | `/api/redis/info` | Redis server info |
| GET | `/api/sync-retries` | Retry queue status |
| WS | `/api/ws` | Real-time event stream |
