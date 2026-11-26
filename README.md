# durequi

Web-based monitoring and management dashboard for the **dureq** job scheduler. Built with React + TypeScript, it provides real-time visibility into jobs, workflows, batches, queues, and worker nodes.

Made for dureq v0.3.1.

## Features

- **Real-time Updates** — WebSocket push, applied in place or read again by ID, with a slow safety poll and automatic polling fallback
- **18 Pages** — Dashboard, Jobs, Runs, Events, Nodes, Schedules, Queues, DLQ, Workflows, Batches, Audit, Operations, Search, Redis Info, Settings (+ detail views)
- **Firing Board** — What each schedule has run and what is due next, on one axis of time
- **Run Visualizations** — Runs by node, run durations, retry ladder, state timeline, batch item grid
- **Needs Attention** — Late schedules, silent nodes, dead jobs, DLQ and paused work on the dashboard
- **Unique Keys** — Who holds the key of a job, and whether a retry would be refused
- **Bulk Operations** — Cancel, retry, delete multiple jobs/workflows/batches by selection or status filter
- **Queue Management** — What is waiting, in flight and delayed; pause and resume queue tiers
- **Event History** — What has happened, of everything or of one job, workflow or batch
- **Paused Jobs** — Resume them by hand
- **Run History Cleanup** — Remove old runs
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

If the API is not on the host the page is from, say where when building it: `VITE_DUREQ_API_BASE=https://dureq.example.com npm run build`. dureqd then has to allow the origin of the page (`allowedOrigins`).

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
| `/jobs/:id` | Job Detail | Schedule, runs and their durations, retry ladder, unique key, audit trail, events, payload editing, cancel/retry/resume/delete |
| `/runs` | Runs | Execution history across all jobs, runs by node, one run by its ID (`/runs?run=`) |
| `/events` | Events | Event history, of everything or of one ID (`/events?id=`) |
| `/nodes` | Nodes | Worker nodes, capacity, runs since they came up, heartbeat status, drain, handlers and their versions |
| `/schedules` | Schedules | Firing board, overlap policy, what happens on failure |
| `/queues` | Queues | Queue tiers, their backlog, pause/resume controls |
| `/dlq` | DLQ | Dead letter queue entries, grouped by error |
| `/workflows` | Workflows | Workflow listing with task graph |
| `/workflows/:id` | Workflow Detail | Task states, dependencies, cancel/retry |
| `/batches` | Batches | Batch job listing with progress |
| `/batches/:id` | Batch Detail | Item grid, per-item results, cancel/retry |
| `/audit` | Audit | State changes of a job over time |
| `/ops` | Operations | Locks, concurrency slots, requeue, run history cleanup, aggregation groups |
| `/search` | Search | Payload search, of all or only live jobs, unique key lookup |
| `/redis` | Redis Info | Redis server diagnostics |
| `/settings` | Settings | Refresh interval, theme, WebSocket toggle, read-only mode |

## Real-time Architecture

```
Redis (event stream of the cluster)
  → dureqd /api/ws (Hub fan-out)
  → Browser WebSocket
  → what an event proves is changed in place
  → what it is about, if it is on screen, is read again
```

Events are collected for a second. Each kind of data has a limit of its own to how often they have it read again (a row 1s, a list 3s, stats 5s, daily stats 60s), and waits twice as long as the last read took. What is being read is not cancelled for that, but read once more after it. A read that has no answer in 15 seconds (an action: 60) is given up, as are reads on their way when the network goes or changes; they are read again on another connection.

- **Live** (green dot): the WebSocket is open and, with a dureq that sends heartbeats, has been heard of in the last 35 seconds. What events announce is read when they come, and every 30 seconds just in case; the rest (stats, nodes, schedules, queues, active runs) at the refresh interval
- **Live, but late** (yellow dot): what comes is more than 15 seconds later than the quickest of the connection, by when it was written: events by their `timestamp`, node by node, and with dureq v0.3.3 or later heartbeats by `server_time_ms`; what events announce is polled, too
- **Connecting** (yellow dot): WebSocket reconnecting, with a growing delay
- **Polling** (gray dot): fallback to the configured refresh interval, or **Not refreshing** if that is off
- **Offline** (gray dot): the browser has no network; the WebSocket is opened again as soon as it has. When it comes back, a socket from before is kept only if it has been heard of within a heartbeat period

After each connection, what is on screen is read again, for nobody announces what has happened in between. The lists of jobs, workflows and batches hold still in between: of what is not on the page, there is a note with a button to refresh. A hidden tab reads nothing until it is looked at. If something cannot be read, the page keeps what it has and says since when.

The WebSocket toggle in Settings allows disabling real-time updates entirely.

## Project Structure

```
src/
├── api.ts                  # Fetch-based API client, type definitions
├── hooks.ts                # TanStack Query hooks (useJobs, useStats, ...), and how each is kept up to date
├── loaders.ts              # Reads many jobs or runs in one request
├── base.ts                 # Where the API is
├── router.tsx              # Route definitions
├── main.tsx                # Entry point, provider tree
├── util.ts                 # Formatting utilities
├── components/
│   ├── charts/             # Firing board, node lanes, run durations, ...
│   ├── ActivityFeed.tsx    # The last events, and those that come in
│   ├── EventTable.tsx      # Events of the history
│   ├── Freshness.tsx       # That data is old, or a list has changed
│   ├── JsonView.tsx        # Collapsible JSON viewer
│   ├── Pagination.tsx      # Reusable pagination controls
│   ├── PriorityBadge.tsx   # Priority level badge
│   ├── RunDrawer.tsx       # Details of a run
│   └── Toasts.tsx          # What came of an action
├── context/
│   ├── SettingsContext.tsx  # Theme, refresh, read-only, WS toggle
│   ├── WebsocketProvider.tsx # WS connection, collects events
│   ├── applyEvents.ts      # What an event changes on screen, and what is read again
│   ├── refresh.ts          # How often, and never twice at once
│   └── otherChanges.ts     # What has changed that is not on screen
├── hooks/
│   └── useWebSocket.ts     # WebSocket hook with reconnection
├── layouts/
│   └── RootLayout.tsx      # Sidebar nav + status indicator
└── pages/                  # 18 page components
```

## API Endpoints

All endpoints are served by `dureqd` on port 8080.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/stats` | Job counts, active schedules/runs/nodes |
| GET | `/api/stats/daily` | 30-day daily breakdown |
| GET | `/api/jobs` | Paginated job list |
| GET | `/api/jobs/:id` | Job detail |
| POST | `/api/jobs/by-ids` | Several jobs; one by one if the server does not have it |
| POST | `/api/runs/by-jobs` | The last runs of several jobs; one by one if the server does not have it |
| POST | `/api/jobs/:id/cancel` | Cancel job |
| POST | `/api/jobs/:id/retry` | Retry job |
| POST | `/api/jobs/:id/resume` | Resume a paused job |
| DELETE | `/api/jobs/:id` | Delete job |
| POST | `/api/jobs/bulk/cancel` | Bulk cancel |
| POST | `/api/jobs/bulk/retry` | Bulk retry |
| POST | `/api/jobs/bulk/delete` | Bulk delete |
| GET | `/api/jobs/:id/runs` | Job run history |
| PUT | `/api/jobs/:id/payload` | Update the payload |
| GET | `/api/jobs/:id/progress` | Progress of its active runs |
| GET | `/api/jobs/:id/audit` | Job audit trail |
| GET | `/api/jobs/:id/events` | Events of a job |
| GET | `/api/runs` | Active runs |
| GET | `/api/runs/:id` | A run, active or finished |
| POST | `/api/runs/:id/requeue` | Run the job of a run again |
| GET | `/api/history/runs` | Global run history |
| DELETE | `/api/history/runs` | Remove old runs |
| GET | `/api/history/events` | Event history |
| GET | `/api/nodes` | Worker nodes |
| POST / DELETE | `/api/nodes/:id/drain` | Drain / undrain a node |
| GET | `/api/schedules` | Scheduled jobs |
| GET | `/api/queues` | Queue tiers and their backlog |
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
| GET | `/api/search/jobs/all` | All jobs by payload |
| GET | `/api/search/{workflows,batches}` | Newest workflow or batch by payload |
| GET / DELETE | `/api/unique-keys/:key` | Who holds a unique key / free it |
| GET / DELETE | `/api/locks/:key` | Inspect / remove a lock |
| GET | `/api/redis/info` | Redis server info |
| GET | `/api/sync-retries` | Retry queue status |
| WS | `/api/ws?v=2` | Real-time event stream, with heartbeats if the server has them |
