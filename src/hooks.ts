import { useQuery, useQueries, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, type ListParams, type JobListParams, type HistoryRunParams, type EventParams, type JobSearchParams } from './api';

import { useWebSocketStatus } from './context/useWebsocketStatus';
import { useSettings } from './context/useSettings';

/** For data that events announce: no polling while the WebSocket is live. */
function useRefetchInterval() {
  const { refreshInterval } = useSettings();
  const { status } = useWebSocketStatus();
  if (status === 'connected') return false;
  return refreshInterval || false;
}

/** For data that changes without an event, such as heartbeats, queues and progress. */
function usePollInterval() {
  return useSettings().refreshInterval || false;
}

export function useStats() {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval,
  });
}

export function useJobs(params: JobListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => api.listJobs(params),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

/** Jobs by ID, for the rows of a list that only has the IDs. */
export function useJobsById(ids: string[]) {
  const refetchInterval = useRefetchInterval();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['job', id],
      queryFn: () => api.getJob(id),
      refetchInterval,
      retry: false,
    })),
    combine: (results) => new Map(results.flatMap((res) => (res.data ? [[res.data.id, res.data] as const] : []))),
  });
}

export function useJob(id: string) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => api.getJob(id),
    refetchInterval,
  });
}

export function useJobRuns(jobId: string, limit = 50) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['jobRuns', jobId, limit],
    queryFn: () => api.listJobRuns(jobId, limit),
    refetchInterval,
  });
}

/** Recent runs, newest first, by job ID. */
export function useRunsOfJobs(ids: string[], limit = 100) {
  const refetchInterval = useRefetchInterval();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['jobRuns', id, limit],
      queryFn: () => api.listJobRuns(id, limit),
      refetchInterval,
    })),
    combine: (results) => new Map(results.map((res, i) => [ids[i], res.data ?? []])),
  });
}

export function useActiveRuns() {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['activeRuns'],
    queryFn: async () => (await api.listActiveRuns()) ?? [],
    refetchInterval,
  });
}

export function useNodes() {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['nodes'],
    queryFn: async () => (await api.listNodes()) ?? [],
    refetchInterval,
  });
}

export function useSchedules(params: ListParams = {}) {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['schedules', params],
    queryFn: () => api.listSchedules(params),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

export function useDLQ(params: ListParams = {}) {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['dlq', params],
    queryFn: () => api.listDLQ(params),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

export function useWorkflows(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['workflows', params],
    queryFn: () => api.listWorkflows(params),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

export function useWorkflow(id: string) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api.getWorkflow(id),
    refetchInterval,
  });
}

export function useHistoryRuns(params: HistoryRunParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['historyRuns', params],
    queryFn: () => api.listHistoryRuns(params),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

/** A run by its ID, active or finished. */
export function useRun(id: string) {
  return useQuery({
    queryKey: ['run', id],
    queryFn: () => api.getRun(id),
    enabled: !!id,
    retry: false,
  });
}

export function useCleanupRunHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => api.cleanupRunHistory(days),
    onSuccess: () => {
      for (const key of ['historyRuns', 'jobRuns', 'run']) qc.invalidateQueries({ queryKey: [key] });
    },
    meta: { done: (res: unknown) => `${(res as { removed: number }).removed.toLocaleString()} runs removed` },
  });
}

// To look for the events of one job, the API reads all events it has. So what is below is
// read when asked for, and not again with every event that comes in.

/** The last events, for a list that the WebSocket keeps up. Read anew when it reconnects. */
export function useRecentEvents(limit: number) {
  const { status } = useWebSocketStatus();
  return useQuery({
    queryKey: ['recentEvents', limit, status === 'connected'],
    queryFn: async () => (await api.listHistoryEvents({ limit })).data ?? [],
    refetchInterval: useRefetchInterval(),
    placeholderData: keepPreviousData,
  });
}

export function useHistoryEvents(params: EventParams = {}) {
  return useQuery({
    queryKey: ['historyEvents', params],
    queryFn: () => api.listHistoryEvents(params),
    placeholderData: keepPreviousData,
  });
}

export function useJobEvents(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['jobEvents', jobId],
    queryFn: async () => (await api.listJobEvents(jobId)) ?? [],
    enabled,
  });
}

/** Invalidates whatever shows jobs, after one of them has been changed. */
function useInvalidateJobs() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['jobs', 'job', 'jobAudit', 'jobRuns', 'schedules', 'activeRuns', 'uniqueKey', 'dlq', 'stats']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useCancelJob() {
  const onSuccess = useInvalidateJobs();
  return useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess,
    meta: { done: 'Job cancelled' },
  });
}

export function useRetryJob() {
  const onSuccess = useInvalidateJobs();
  return useMutation({
    mutationFn: (id: string) => api.retryJob(id),
    onSuccess,
    meta: { done: 'Job retried' },
  });
}

export function useResumeJob() {
  const onSuccess = useInvalidateJobs();
  return useMutation({
    mutationFn: (id: string) => api.resumeJob(id),
    onSuccess,
    meta: { done: 'Job resumed' },
  });
}

export function useDeleteJob() {
  const onSuccess = useInvalidateJobs();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess,
    meta: { done: 'Job deleted' },
  });
}

export function useUpdateJobPayload() {
  const onSuccess = useInvalidateJobs();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => api.updateJobPayload(id, payload),
    onSuccess,
    meta: { done: 'Payload saved' },
  });
}

export function useCancelWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow'] });
    },
    meta: { done: 'Workflow cancelled' },
  });
}

export function useRetryWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow'] });
    },
    meta: { done: 'Workflow retried' },
  });
}

export function useWorkflowTaskResult(wfId: string, taskName: string) {
  return useQuery({
    queryKey: ['workflowTaskResult', wfId, taskName],
    queryFn: () => api.getWorkflowTaskResult(wfId, taskName),
    enabled: !!wfId && !!taskName,
    retry: false,
  });
}

export function useWorkflowSignalStats(id: string) {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['workflowSignalStats', id],
    queryFn: () => api.getWorkflowSignalStats(id),
    enabled: !!id,
    refetchInterval,
  });
}

export function useSuspendWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.suspendWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow'] });
    },
    meta: { done: 'Workflow suspended' },
  });
}

export function useResumeWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resumeWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow'] });
    },
    meta: { done: 'Workflow resumed' },
  });
}

// --- Batches ---

export function useBatches(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['batches', params],
    queryFn: () => api.listBatches(params),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

export function useBatch(id: string) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['batch', id],
    queryFn: () => api.getBatch(id),
    refetchInterval,
  });
}

export function useBatchResults(id: string) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['batchResults', id],
    queryFn: () => api.getBatchResults(id),
    refetchInterval,
  });
}

export function useCancelBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch'] });
    },
    meta: { done: 'Batch cancelled' },
  });
}

export function useRetryBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, retryFailedOnly }: { id: string; retryFailedOnly: boolean }) =>
      api.retryBatch(id, retryFailedOnly),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch'] });
    },
    meta: { done: 'Batch retried' },
  });
}

// --- Queues ---

export function useQueues() {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['queues'],
    queryFn: async () => (await api.listQueues()) ?? [],
    refetchInterval,
  });
}

export function usePauseQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tierName: string) => api.pauseQueue(tierName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
    meta: { done: 'Queue paused' },
  });
}

export function useResumeQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tierName: string) => api.resumeQueue(tierName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
    meta: { done: 'Queue resumed' },
  });
}

// --- Daily Stats ---

export function useDailyStats(days = 30) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['dailyStats', days],
    queryFn: () => api.getDailyStats(days),
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

// --- Redis Info ---

export function useRedisInfo() {
  return useQuery({
    queryKey: ['redisInfo'],
    queryFn: api.getRedisInfo,
  });
}

// --- Sync Retries ---

export function useSyncRetries() {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['syncRetries'],
    queryFn: api.getSyncRetries,
    refetchInterval,
  });
}

// --- Bulk Operations ---

type BulkVars = { ids: string[]; status?: string };

function useBulk(
  keys: string[],
  what: string,
  mutationFn: (v: BulkVars) => Promise<{ affected: number }>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of keys) qc.invalidateQueries({ queryKey: [key] });
    },
    meta: {
      done: (res: unknown, vars: unknown) => {
        const { affected } = res as { affected: number };
        const asked = (vars as BulkVars).ids.length;
        const skipped = asked > affected ? `; ${asked - affected} skipped` : '';
        return `${affected} ${what}${skipped}`;
      },
    },
  });
}

const JOB_KEYS = ['jobs', 'job', 'schedules', 'activeRuns', 'stats'];
const WORKFLOW_KEYS = ['workflows', 'workflow', 'stats'];
const BATCH_KEYS = ['batches', 'batch', 'stats'];

export const useBulkCancelJobs = () => useBulk(JOB_KEYS, 'cancelled', (v) => api.bulkCancelJobs(v.ids, v.status));
export const useBulkRetryJobs = () => useBulk(JOB_KEYS, 'retried', (v) => api.bulkRetryJobs(v.ids, v.status));
export const useBulkDeleteJobs = () => useBulk(JOB_KEYS, 'deleted', (v) => api.bulkDeleteJobs(v.ids, v.status));

export const useBulkCancelWorkflows = () => useBulk(WORKFLOW_KEYS, 'cancelled', (v) => api.bulkCancelWorkflows(v.ids, v.status));
export const useBulkRetryWorkflows = () => useBulk(WORKFLOW_KEYS, 'retried', (v) => api.bulkRetryWorkflows(v.ids, v.status));
export const useBulkDeleteWorkflows = () => useBulk(WORKFLOW_KEYS, 'deleted', (v) => api.bulkDeleteWorkflows(v.ids, v.status));

export const useBulkCancelBatches = () => useBulk(BATCH_KEYS, 'cancelled', (v) => api.bulkCancelBatches(v.ids, v.status));
export const useBulkRetryBatches = () => useBulk(BATCH_KEYS, 'retried', (v) => api.bulkRetryBatches(v.ids, v.status));
export const useBulkDeleteBatches = () => useBulk(BATCH_KEYS, 'deleted', (v) => api.bulkDeleteBatches(v.ids, v.status));

// --- Payload Search ---

export function useSearchJobsByPayload(params: JobSearchParams) {
  return useQuery({
    queryKey: ['searchJobs', params],
    queryFn: () => api.searchJobsByPayload(params),
    enabled: !!params.path && !!params.value,
    retry: false,
  });
}

export function useSearchWorkflowsByPayload(path: string, value: string) {
  return useQuery({
    queryKey: ['searchWorkflows', path, value],
    queryFn: () => api.searchWorkflowsByPayload(path, value),
    enabled: !!path && !!value,
    retry: false,
  });
}

export function useSearchBatchesByPayload(path: string, value: string) {
  return useQuery({
    queryKey: ['searchBatches', path, value],
    queryFn: () => api.searchBatchesByPayload(path, value),
    enabled: !!path && !!value,
    retry: false,
  });
}

// --- Unique Keys ---

export function useCheckUniqueKey(key: string) {
  return useQuery({
    queryKey: ['uniqueKey', key],
    queryFn: () => api.checkUniqueKey(key),
    enabled: !!key,
    retry: false,
  });
}

export function useDeleteUniqueKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.deleteUniqueKey(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uniqueKey'] });
    },
    meta: { done: 'Unique key deleted' },
  });
}

// --- Audit Trail ---

export function useJobAuditTrail(jobId: string) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['jobAudit', jobId],
    queryFn: async () => (await api.getJobAuditTrail(jobId)) ?? [],
    enabled: !!jobId,
    refetchInterval,
  });
}

export function useAuditCounts(ids: string[]) {
  return useQuery({
    queryKey: ['auditCounts', ids],
    queryFn: () => api.getAuditCounts(ids),
    enabled: ids.length > 0,
  });
}

export function useWorkflowAuditTrail(workflowId: string) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['workflowAudit', workflowId],
    queryFn: async () => (await api.getWorkflowAuditTrail(workflowId)) ?? [],
    enabled: !!workflowId,
    refetchInterval,
  });
}

// --- Repair / Inspect ---

export function useRequeueRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.requeueRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['historyRuns'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    meta: { done: 'Run requeued' },
  });
}

export function useLockInfo(key: string) {
  return useQuery({
    queryKey: ['lock', key],
    queryFn: () => api.getLock(key),
    enabled: !!key,
    retry: false,
  });
}

export function useForceUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.forceUnlock(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lock'] }),
    meta: { done: 'Lock removed' },
  });
}

export function useConcurrencyInfo(key: string) {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['concurrency', key],
    queryFn: () => api.getConcurrencyInfo(key),
    enabled: !!key,
    refetchInterval,
    retry: false,
  });
}

export function useGroups() {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.listGroups()) ?? [],
    refetchInterval,
  });
}

export function useJobProgress(jobId: string) {
  const refetchInterval = usePollInterval();
  return useQuery({
    queryKey: ['jobProgress', jobId],
    queryFn: () => api.getJobProgress(jobId),
    enabled: !!jobId,
    refetchInterval,
    retry: false,
  });
}

// --- Node Drain ---

/** The IDs of the nodes, out of those given, that are draining. */
export function useDrainingNodes(nodeIds: string[]) {
  const refetchInterval = usePollInterval();
  return useQueries({
    queries: nodeIds.map((id) => ({
      queryKey: ['nodeDrain', id],
      queryFn: () => api.getNodeDrainStatus(id),
      refetchInterval,
    })),
    combine: (results) => new Set(results.flatMap((res) => (res.data?.draining ? [res.data.node_id] : []))),
  });
}

export function useDrainNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => api.drainNode(nodeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodeDrain'] }),
    meta: { done: 'Node is draining' },
  });
}

export function useUndrainNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => api.undrainNode(nodeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodeDrain'] }),
    meta: { done: 'Node takes work again' },
  });
}
