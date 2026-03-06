import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ListParams, type HistoryRunParams } from './api';
import { useSettings } from './context/SettingsContext';
import { useWebSocketStatus } from './context/WebSocketContext';

function useRefetchInterval() {
  const { refreshInterval } = useSettings();
  const { status } = useWebSocketStatus();
  if (status === 'connected') return false; // WS live — no polling
  return refreshInterval || false; // fallback polling
}

export function useStats() {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval,
  });
}

export function useJobs(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => api.listJobs(params),
    refetchInterval,
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

export function useJobEvents(jobId: string, limit = 50) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['jobEvents', jobId, limit],
    queryFn: () => api.listJobEvents(jobId, limit),
    refetchInterval,
  });
}

export function useNodes() {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['nodes'],
    queryFn: api.listNodes,
    refetchInterval,
  });
}

export function useSchedules(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['schedules', params],
    queryFn: () => api.listSchedules(params),
    refetchInterval,
  });
}

export function useDLQ(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['dlq', params],
    queryFn: () => api.listDLQ(params),
    refetchInterval,
  });
}

export function useWorkflows(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['workflows', params],
    queryFn: () => api.listWorkflows(params),
    refetchInterval,
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
  });
}

export function useHistoryEvents(params: { limit?: number; offset?: number; job_id?: string } = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['historyEvents', params],
    queryFn: () => api.listHistoryEvents(params),
    refetchInterval,
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useCancelWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useRetryWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryWorkflow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

// --- Batches ---

export function useBatches(params: ListParams = {}) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['batches', params],
    queryFn: () => api.listBatches(params),
    refetchInterval,
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
  });
}

// --- Queues ---

export function useQueues() {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['queues'],
    queryFn: api.listQueues,
    refetchInterval,
  });
}

export function usePauseQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tierName: string) => api.pauseQueue(tierName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
  });
}

export function useResumeQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tierName: string) => api.resumeQueue(tierName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queues'] }),
  });
}

// --- Daily Stats ---

export function useDailyStats(days = 30) {
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['dailyStats', days],
    queryFn: () => api.getDailyStats(days),
    refetchInterval,
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
  const refetchInterval = useRefetchInterval();
  return useQuery({
    queryKey: ['syncRetries'],
    queryFn: api.getSyncRetries,
    refetchInterval,
  });
}

// --- Bulk Operations ---

export function useBulkCancelJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkCancelJobs(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useBulkRetryJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkRetryJobs(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useBulkDeleteJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkDeleteJobs(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

// --- Bulk Workflow Operations ---

export function useBulkCancelWorkflows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkCancelWorkflows(ids, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useBulkRetryWorkflows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkRetryWorkflows(ids, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useBulkDeleteWorkflows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkDeleteWorkflows(ids, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

// --- Bulk Batch Operations ---

export function useBulkCancelBatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkCancelBatches(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch'] });
    },
  });
}

export function useBulkRetryBatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkRetryBatches(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch'] });
    },
  });
}

export function useBulkDeleteBatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status?: string }) =>
      api.bulkDeleteBatches(ids, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch'] });
    },
  });
}

// --- Payload Search ---

export function useSearchJobsByPayload(path: string, value: string) {
  return useQuery({
    queryKey: ['searchJobs', path, value],
    queryFn: () => api.searchJobsByPayload(path, value),
    enabled: !!path && !!value,
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
  });
}
