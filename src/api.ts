// API client for the dureq monitoring HTTP endpoints.

export interface Job {
  id: string;
  task_type: string;
  payload: unknown;
  schedule: Schedule;
  retry_policy?: RetryPolicy;
  priority?: number;
  schedule_to_start_timeout?: number;
  status: string;
  attempt: number;
  last_error?: string;
  last_run_at?: string;
  next_run_at?: string;
  completed_at?: string;
  tags?: string[];
  unique_key?: string;
  dlq_after?: number;
  workflow_id?: string;
  workflow_task?: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  type: string;
  run_at?: string;
  interval?: string;
  cron_expr?: string;
  regular_interval?: number;
  at_times?: { hour: number; minute: number; second: number }[];
  included_days?: number[];
  starts_at?: string;
  ends_at?: string;
  timezone?: string;
}

export interface RetryPolicy {
  max_attempts: number;
  initial_delay: number;
  max_delay: number;
  multiplier: number;
  jitter: number;
}

export interface NodeInfo {
  node_id: string;
  address?: string;
  task_types: string[];
  started_at: string;
  last_heartbeat: string;
  pool_stats?: PoolStats;
  active_run_ids?: string[];
}

export interface PoolStats {
  running_workers: number;
  idle_workers: number;
  max_concurrency: number;
  total_submitted: number;
  total_completed: number;
  total_failed: number;
  queue_length: number;
}

export interface ScheduleEntry {
  job_id: string;
  next_run_at: string;
  schedule: Schedule;
}

export interface Stats {
  job_counts: Record<string, number>;
  active_schedules: number;
  active_runs: number;
  active_nodes: number;
}

export interface JobRun {
  id: string;
  job_id: string;
  node_id: string;
  status: string;
  attempt: number;
  error?: string;
  started_at: string;
  finished_at?: string;
  duration: number;
  last_heartbeat_at?: string;
}

export interface JobEvent {
  type: string;
  job_id?: string;
  run_id?: string;
  node_id?: string;
  task_type?: string;
  error?: string;
  attempt: number;
  timestamp: string;
  affected_run_ids?: string[];
}

export interface WorkflowTaskDef {
  name: string;
  task_type: string;
  payload?: unknown;
  depends_on?: string[];
}

export interface WorkflowDefinition {
  name: string;
  tasks: WorkflowTaskDef[];
  execution_timeout?: number;
  retry_policy?: RetryPolicy;
  default_priority?: number;
}

export interface WorkflowInstance {
  id: string;
  workflow_name: string;
  status: string;
  tasks: Record<string, WorkflowTaskState>;
  definition: WorkflowDefinition;
  input?: unknown;
  deadline?: string;
  attempt?: number;
  max_attempts?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface WorkflowTaskState {
  name: string;
  job_id?: string;
  status: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

// --- Batch types ---

export interface BatchDefinition {
  name: string;
  onetime_task_type?: string;
  onetime_payload?: unknown;
  item_task_type: string;
  items: BatchItem[];
  failure_policy?: string;
  chunk_size?: number;
  execution_timeout?: number;
  retry_policy?: RetryPolicy;
  default_priority?: number;
}

export interface BatchItem {
  id: string;
  payload: unknown;
}

export interface BatchInstance {
  id: string;
  name: string;
  status: string;
  definition: BatchDefinition;
  onetime_state?: BatchOnetimeState;
  item_states: Record<string, BatchItemState>;
  total_items: number;
  completed_items: number;
  failed_items: number;
  running_items: number;
  pending_items: number;
  next_chunk_index: number;
  deadline?: string;
  attempt?: number;
  max_attempts?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface BatchOnetimeState {
  job_id?: string;
  status: string;
  result_data?: unknown;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export interface BatchItemState {
  item_id: string;
  job_id?: string;
  status: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export interface BatchItemResult {
  batch_id: string;
  item_id: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

async function postAction(path: string): Promise<void> {
  const res = await fetch(path, { method: 'POST' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function deleteAction(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

export interface Paginated<T> {
  data: T[] | null;
  total: number;
}

export interface ListParams {
  limit?: number;
  offset?: number;
  sort?: 'newest' | 'oldest';
  status?: string;
}

function buildQS(params: ListParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
}

// --- Queue types ---

export interface QueueInfo {
  name: string;
  weight: number;
  stream_length: number;
  pending_count: number;
  paused: boolean;
}

// --- Daily Stats ---

export interface DailyStat {
  date: string;
  processed: number;
  failed: number;
}

// --- Sync Retry Stats ---

export interface SyncRetryStats {
  pending: number;
  failed: number;
  recent: SyncRetryItem[];
}

export interface SyncRetryItem {
  description: string;
  failed_at: string;
  retries: number;
}

// --- Redis Info ---

export type RedisInfoSections = Record<string, Record<string, string>>;

async function putJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  getStats: () => fetchJSON<Stats>('/api/stats'),
  listJobs: (params: ListParams = {}) =>
    fetchJSON<Paginated<Job>>(`/api/jobs?${buildQS(params)}`),
  getJob: (id: string) => fetchJSON<Job>(`/api/jobs/${id}`),
  deleteJob: (id: string) => deleteAction(`/api/jobs/${id}`),
  listNodes: () => fetchJSON<NodeInfo[]>('/api/nodes'),
  listSchedules: (params: ListParams = {}) =>
    fetchJSON<Paginated<ScheduleEntry>>(`/api/schedules?${buildQS(params)}`),
  listDLQ: (params: ListParams = {}) =>
    fetchJSON<Paginated<unknown>>(`/api/dlq?${buildQS(params)}`),
  cancelJob: (id: string) => postAction(`/api/jobs/${id}/cancel`),
  retryJob: (id: string) => postAction(`/api/jobs/${id}/retry`),
  updateJobPayload: (id: string, payload: unknown) =>
    putJSON<{ status: string }>(`/api/jobs/${id}/payload`, { payload }),
  health: () => fetchJSON<{ status: string }>('/api/health'),

  // History
  listJobEvents: (jobId: string, limit = 50) =>
    fetchJSON<JobEvent[]>(`/api/jobs/${jobId}/events?limit=${limit}`),
  listJobRuns: (jobId: string, limit = 50) =>
    fetchJSON<JobRun[]>(`/api/jobs/${jobId}/runs?limit=${limit}`),
  listHistoryRuns: (params: { limit?: number; offset?: number; sort?: string; status?: string; job_id?: string } = {}) => {
    return fetchJSON<Paginated<JobRun>>(`/api/history/runs?${buildQS({ ...params, sort: params.sort as 'newest' | 'oldest' | undefined })}`);
  },
  listHistoryEvents: (params: { limit?: number; offset?: number; job_id?: string } = {}) => {
    return fetchJSON<Paginated<JobEvent>>(`/api/history/events?${buildQS(params)}`);
  },

  // Workflows
  listWorkflows: (params: ListParams = {}) =>
    fetchJSON<Paginated<WorkflowInstance>>(`/api/workflows?${buildQS(params)}`),
  getWorkflow: (id: string) => fetchJSON<WorkflowInstance>(`/api/workflows/${id}`),
  cancelWorkflow: (id: string) => postAction(`/api/workflows/${id}/cancel`),
  retryWorkflow: (id: string) => postAction(`/api/workflows/${id}/retry`),

  // Batches
  listBatches: (params: ListParams = {}) =>
    fetchJSON<Paginated<BatchInstance>>(`/api/batches?${buildQS(params)}`),
  getBatch: (id: string) => fetchJSON<BatchInstance>(`/api/batches/${id}`),
  getBatchResults: (id: string) => fetchJSON<BatchItemResult[]>(`/api/batches/${id}/results`),
  getBatchItemResult: (id: string, itemId: string) =>
    fetchJSON<BatchItemResult>(`/api/batches/${id}/results/${itemId}`),
  cancelBatch: (id: string) => postAction(`/api/batches/${id}/cancel`),
  retryBatch: (id: string, retryFailedOnly: boolean) =>
    postJSON<BatchInstance>(`/api/batches/${id}/retry`, { retry_failed_only: retryFailedOnly }),

  // Queues
  listQueues: () => fetchJSON<QueueInfo[]>('/api/queues'),
  pauseQueue: (tierName: string) => postAction(`/api/queues/${tierName}/pause`),
  resumeQueue: (tierName: string) => postAction(`/api/queues/${tierName}/resume`),

  // Daily Stats
  getDailyStats: (days = 30) => fetchJSON<DailyStat[]>(`/api/stats/daily?days=${days}`),

  // Redis Info
  getRedisInfo: () => fetchJSON<RedisInfoSections>('/api/redis/info'),

  // Sync Retries
  getSyncRetries: () => fetchJSON<SyncRetryStats>('/api/sync-retries'),

  // Bulk Operations
  bulkCancelJobs: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/jobs/bulk/cancel', { ids, status }),
  bulkRetryJobs: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/jobs/bulk/retry', { ids, status }),
  bulkDeleteJobs: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/jobs/bulk/delete', { ids, status }),
  bulkCancelWorkflows: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/workflows/bulk/cancel', { ids, status }),
  bulkRetryWorkflows: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/workflows/bulk/retry', { ids, status }),
  bulkDeleteWorkflows: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/workflows/bulk/delete', { ids, status }),
  bulkCancelBatches: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/batches/bulk/cancel', { ids, status }),
  bulkRetryBatches: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/batches/bulk/retry', { ids, status }),
  bulkDeleteBatches: (ids: string[], status?: string) =>
    postJSON<{ affected: number }>('/api/batches/bulk/delete', { ids, status }),
};
