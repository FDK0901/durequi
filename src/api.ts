// API client for the dureq monitoring HTTP endpoints.

export interface ConcurrencyKey {
  key: string;
  max_concurrency: number;
}

export type ResultReusePolicy = 'always' | 'never' | 'on_success';

export interface Job {
  id: string;
  task_type: string;
  payload: unknown;
  schedule: Schedule;
  retry_policy?: RetryPolicy;
  priority?: number;
  schedule_to_start_timeout?: string;
  heartbeat_timeout?: string;
  status: string;
  /** Attempts of the current execution; a recurring job starts at 0 with every firing. */
  attempt: number;
  /** Executions that have finished, over the job's whole life (since dureq v0.2.5). */
  run_count?: number;
  consecutive_errors?: number;
  last_error?: string;
  last_run_at?: string;
  next_run_at?: string;
  completed_at?: string;
  paused_at?: string;
  resume_at?: string;
  tags?: string[];
  headers?: Record<string, string>;
  unique_key?: string;
  dlq_after?: number;
  workflow_id?: string;
  workflow_task?: string;
  batch_id?: string;
  batch_item?: string;
  batch_role?: string;
  concurrency_keys?: ConcurrencyKey[];
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
  overlap_policy?: OverlapPolicy;
  catchup_window?: string;
  max_backfill_per_tick?: number;
  jitter?: string;
  /** A firing that is given up goes to the DLQ instead of ending the job (since dureq v0.2.5). */
  keep_on_failure?: boolean;
}

export type OverlapPolicy = 'ALLOW_ALL' | 'SKIP' | 'BUFFER_ONE' | 'BUFFER_ALL' | 'REPLACE';

export interface RetryPolicy {
  max_attempts: number;
  initial_delay: number; // ns
  max_delay: number; // ns
  multiplier: number;
  jitter: number;
  non_retryable_errors?: string[];
  pause_after_err_count?: number;
  pause_retry_delay?: number; // ns
}

export interface NodeInfo {
  node_id: string;
  address?: string;
  task_types: string[];
  started_at: string;
  last_heartbeat: string;
  pool_stats?: PoolStats;
  active_run_ids?: string[];
  handler_versions?: Record<string, string>;
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
  last_processed_at?: string;
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
  duration: number; // ns
  last_heartbeat_at?: string;
  progress?: unknown;
  /** The logical operation this run executes (since dureq v0.2.5). */
  operation_key?: string;
}

export interface JobEvent {
  type: string;
  job_id?: string;
  run_id?: string;
  node_id?: string;
  task_type?: string;
  error?: string;
  attempt?: number;
  timestamp: string;
  affected_run_ids?: string[];
  workflow_id?: string;
}

export interface DLQMessage {
  run_id: string;
  job_id: string;
  task_type: string;
  payload?: unknown;
  attempt: number;
  metadata?: Record<string, string>;
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
  result_reuse?: ResultReusePolicy;
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
  continued_from?: string;
  continued_to?: string;
  archived_task_count?: number;
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

/** An error response of the API, with the message it carries. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.ok) return res;
  const body = await res.text();
  let message = body || res.statusText;
  try {
    message = JSON.parse(body).error ?? message;
  } catch {
    // Not JSON, e.g. from a proxy in between.
  }
  throw new ApiError(res.status, message);
}

async function fetchJSON<T>(path: string): Promise<T> {
  return (await request(path)).json();
}

async function postAction(path: string): Promise<void> {
  await request(path, { method: 'POST' });
}

async function sendJSON<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const postJSON = <T>(path: string, body: unknown) => sendJSON<T>('POST', path, body);
const putJSON = <T>(path: string, body: unknown) => sendJSON<T>('PUT', path, body);

async function deleteAction(path: string): Promise<void> {
  await request(path, { method: 'DELETE' });
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

/** The API filters jobs by one of these; if several are given it takes the first. */
export interface JobListParams extends ListParams {
  task_type?: string;
  tag?: string;
}

/** The API filters runs by job or by status, not by both. */
export interface HistoryRunParams {
  limit?: number;
  offset?: number;
  sort?: string;
  status?: string;
  job_id?: string;
  since?: string;
  until?: string;
}

export interface UniqueKeyResult {
  exists: boolean;
  job_id: string;
}

function buildQS(params: object): string {
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

export const api = {
  getStats: () => fetchJSON<Stats>('/api/stats'),
  listJobs: (params: JobListParams = {}) =>
    fetchJSON<Paginated<Job>>(`/api/jobs?${buildQS(params)}`),
  getJob: (id: string) => fetchJSON<Job>(`/api/jobs/${id}`),
  deleteJob: (id: string) => deleteAction(`/api/jobs/${id}`),
  listNodes: () => fetchJSON<NodeInfo[] | null>('/api/nodes'),
  listActiveRuns: () => fetchJSON<JobRun[] | null>('/api/runs'),
  listSchedules: (params: ListParams = {}) =>
    fetchJSON<Paginated<ScheduleEntry>>(`/api/schedules?${buildQS(params)}`),
  listDLQ: (params: ListParams = {}) =>
    fetchJSON<Paginated<DLQMessage>>(`/api/dlq?${buildQS(params)}`),
  cancelJob: (id: string) => postAction(`/api/jobs/${id}/cancel`),
  retryJob: (id: string) => postAction(`/api/jobs/${id}/retry`),
  updateJobPayload: (id: string, payload: unknown) =>
    putJSON<{ status: string }>(`/api/jobs/${id}/payload`, { payload }),
  health: () => fetchJSON<{ status: string }>('/api/health'),

  // History
  listJobRuns: (jobId: string, limit = 50) =>
    fetchJSON<JobRun[] | null>(`/api/jobs/${jobId}/runs?limit=${limit}`),
  listHistoryRuns: (params: HistoryRunParams = {}) =>
    fetchJSON<Paginated<JobRun>>(`/api/history/runs?${buildQS(params)}`),

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
    postJSON<{ status: string }>(`/api/batches/${id}/retry`, { retry_failed_only: retryFailedOnly }),

  // Queues
  listQueues: () => fetchJSON<QueueInfo[] | null>('/api/queues'),
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
  searchJobsByPayload: (path: string, value: string, task_type?: string) =>
    fetchJSON<Job>(`/api/search/jobs?${buildQS({ path, value, task_type })}`),
  searchWorkflowsByPayload: (path: string, value: string) =>
    fetchJSON<WorkflowInstance>(`/api/search/workflows?${buildQS({ path, value })}`),
  searchBatchesByPayload: (path: string, value: string) =>
    fetchJSON<BatchInstance>(`/api/search/batches?${buildQS({ path, value })}`),

  // Unique keys
  checkUniqueKey: (key: string) =>
    fetchJSON<UniqueKeyResult>(`/api/unique-keys/${encodeURIComponent(key)}`),
  deleteUniqueKey: (key: string) =>
    deleteAction(`/api/unique-keys/${encodeURIComponent(key)}`),

  // Audit trail
  getJobAuditTrail: (jobId: string) =>
    fetchJSON<AuditEntry[] | null>(`/api/jobs/${jobId}/audit`),
  getAuditCounts: (ids: string[]) =>
    postJSON<Record<string, number>>('/api/audit/counts', { ids }),
  getWorkflowAuditTrail: (workflowId: string) =>
    fetchJSON<WorkflowAuditEntry[] | null>(`/api/workflows/${workflowId}/audit`),

  // Node drain
  getNodeDrainStatus: (nodeId: string) =>
    fetchJSON<NodeDrainStatus>(`/api/nodes/${nodeId}/drain`),
  drainNode: (nodeId: string) => postAction(`/api/nodes/${nodeId}/drain`),
  undrainNode: (nodeId: string) => deleteAction(`/api/nodes/${nodeId}/drain`),

  // Repair / Inspect
  requeueRun: (runId: string) => postAction(`/api/runs/${runId}/requeue`),
  getLock: (key: string) =>
    fetchJSON<LockInfo>(`/api/locks/${encodeURIComponent(key)}`),
  forceUnlock: (key: string) =>
    deleteAction(`/api/locks/${encodeURIComponent(key)}`),
  getConcurrencyInfo: (key: string) =>
    fetchJSON<ConcurrencyInfo>(`/api/concurrency/${encodeURIComponent(key)}`),

  // Groups
  listGroups: () => fetchJSON<GroupInfo[] | null>('/api/groups'),

  // Progress of a job's active runs
  getJobProgress: (jobId: string) =>
    fetchJSON<RunProgress[]>(`/api/jobs/${jobId}/progress`),

  // Workflow signal stats
  getWorkflowSignalStats: (id: string) =>
    fetchJSON<SignalStats>(`/api/workflows/${id}/signals/stats`),
};

// --- Repair / Inspect types ---

export interface LockInfo {
  key: string;
  owner: string;
  ttl_seconds: number;
  exists: boolean;
}

export interface ConcurrencyInfo {
  key: string;
  active_slots: number;
  active_run_ids: string[] | null;
}

export interface GroupInfo {
  name: string;
  size: number;
}

export interface RunProgress {
  run_id: string;
  status: string;
  last_heartbeat_at?: string;
  /** Whatever the handler reports; see readProgress. */
  progress?: unknown;
}

export interface SignalStats {
  pending_count: number;
  oldest_unacked_age_ms: number;
}
