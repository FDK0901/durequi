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
  non_retryable_errors?: string[];
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
  workflow_counts?: Record<string, number>;
  batch_counts?: Record<string, number>;
  active_workflows?: number;
  active_batches?: number;
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

export interface Precondition {
  type: string;
  task?: string;
  path: string;
  expected: string;
}

export interface WorkflowTaskDef {
  name: string;
  task_type: string;
  payload?: unknown;
  depends_on?: string[];
  priority?: number;
  type?: '' | 'condition' | 'subflow';
  condition_routes?: Record<number, string>;
  max_iterations?: number;
  child_workflow_def?: WorkflowDefinition;
  allow_failure?: boolean;
  result_from?: string;
  preconditions?: Precondition[];
}

export interface WorkflowHookDef {
  task_type: string;
  payload?: unknown;
  timeout?: string;
}

export interface WorkflowHooks {
  on_init?: WorkflowHookDef;
  on_success?: WorkflowHookDef;
  on_failure?: WorkflowHookDef;
  on_exit?: WorkflowHookDef;
}

export interface WorkflowDefinition {
  name: string;
  tasks: WorkflowTaskDef[];
  execution_timeout?: number;
  retry_policy?: RetryPolicy;
  default_priority?: number;
  hooks?: WorkflowHooks;
}

export interface WorkflowInstance {
  id: string;
  workflow_name: string;
  status: string;
  tasks: Record<string, WorkflowTaskState>;
  definition: WorkflowDefinition;
  input?: unknown;
  output?: unknown;
  deadline?: string;
  attempt?: number;
  max_attempts?: number;
  parent_workflow_id?: string;
  parent_task_name?: string;
  hook_states?: Record<string, WorkflowTaskState>;
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
  child_workflow_id?: string;
  condition_route?: number;
  subflow_tasks?: string[];
  iterations?: number;
  skipped?: boolean;
  skip_reason?: string;
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
  name?: string;
}

export interface HistoryRunParams {
  limit?: number;
  offset?: number;
  sort?: string;
  status?: string;
  job_id?: string;
  node_id?: string;
  task_type?: string;
  since?: string;
  until?: string;
}

export interface UniqueKeyResult {
  unique_key: string;
  exists: boolean;
  job_id: string;
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
  fetch_batch: number;
  rate_limit?: number;
  rate_burst?: number;
  paused: boolean;
  size: number;
}

// --- Audit Trail ---

export interface AuditEntry {
  id: string;
  status: string;
  error?: string;
  timestamp: string;
}

export interface WorkflowAuditEntry {
  task_name: string;
  job_id: string;
  id: string;
  status: string;
  error?: string;
  timestamp: string;
}

// --- Node Drain ---

export interface NodeDrainStatus {
  node_id: string;
  draining: boolean;
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

export interface RedisNodeInfo {
  addr: string;
  role: string;
  sections: RedisInfoSections;
}

export interface RedisInfoResponse {
  mode: 'cluster' | 'standalone';
  nodes: RedisNodeInfo[];
}

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
  listHistoryRuns: (params: HistoryRunParams = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    return fetchJSON<Paginated<JobRun>>(`/api/history/runs?${qs.toString()}`);
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
  suspendWorkflow: (id: string) => postAction(`/api/workflows/${id}/suspend`),
  resumeWorkflow: (id: string) => postAction(`/api/workflows/${id}/resume`),
  getWorkflowTaskResult: (wfId: string, taskName: string) =>
    fetchJSON<{ output: unknown }>(`/api/workflows/${wfId}/tasks/${encodeURIComponent(taskName)}/result`),
  validateWorkflow: (def: WorkflowDefinition) =>
    postJSON<{ valid: boolean; errors?: string[] }>('/api/workflows/validate', def),

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
  getRedisInfo: () => fetchJSON<RedisInfoResponse>('/api/redis/info'),

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

  // Payload search (JSONPath)
  searchJobsByPayload: (path: string, value: string) =>
    fetchJSON<Job>(`/api/search/jobs?path=${encodeURIComponent(path)}&value=${encodeURIComponent(value)}`),
  searchWorkflowsByPayload: (path: string, value: string) =>
    fetchJSON<WorkflowInstance>(`/api/search/workflows?path=${encodeURIComponent(path)}&value=${encodeURIComponent(value)}`),
  searchBatchesByPayload: (path: string, value: string) =>
    fetchJSON<BatchInstance>(`/api/search/batches?path=${encodeURIComponent(path)}&value=${encodeURIComponent(value)}`),

  // Unique keys
  checkUniqueKey: (key: string) =>
    fetchJSON<UniqueKeyResult>(`/api/unique-keys/${encodeURIComponent(key)}`),
  deleteUniqueKey: (key: string) =>
    deleteAction(`/api/unique-keys/${encodeURIComponent(key)}`),

  // Audit trail
  getJobAuditTrail: (jobId: string) =>
    fetchJSON<AuditEntry[]>(`/api/jobs/${jobId}/audit`),
  getAuditCounts: (ids: string[]) =>
    postJSON<Record<string, number>>('/api/audit/counts', { ids }),
  getWorkflowAuditTrail: (workflowId: string) =>
    fetchJSON<WorkflowAuditEntry[]>(`/api/workflows/${workflowId}/audit`),

  // Node drain
  getNodeDrainStatus: (nodeId: string) =>
    fetchJSON<NodeDrainStatus>(`/api/nodes/${nodeId}/drain`),
  drainNode: (nodeId: string) => postAction(`/api/nodes/${nodeId}/drain`),
  undrainNode: (nodeId: string) => deleteAction(`/api/nodes/${nodeId}/drain`),
};
