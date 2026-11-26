import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useJobs, useActiveRuns, useCancelJob, useRetryJob, useResumeJob, useBulkCancelJobs, useBulkRetryJobs, useBulkDeleteJobs, useAuditCounts } from '../hooks';
import { useSettings } from '../context/useSettings';
import { isRetryable, isTerminal, timeAgo, isBlocking } from '../util';
import { CopyId } from '../components/CopyId';
import { PriorityBadge } from '../components/PriorityBadge';
import { Pagination, SortSelect } from '../components/Pagination';
import { ChangesNote, StaleNote } from '../components/Freshness';

const STATUSES = [
  '',
  'pending',
  'scheduled',
  'completed',
  'failed',
  'retrying',
  'paused',
  'dead',
  'cancelled',
];

const PAGE_SIZE = 10;

export default function Jobs() {
  // The API filters by one of these at a time.
  const [params, setParams] = useSearchParams();
  const filter = params.get('status') ?? '';
  const taskType = params.get('task_type') ?? '';
  const tag = params.get('tag') ?? '';
  const [offset, setOffset] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { readOnly, showPayload } = useSettings();
  const { data: activeRuns } = useActiveRuns();
  const { data, isLoading, error, dataUpdatedAt, refetch } = useJobs({
    status: filter || undefined,
    task_type: taskType || undefined,
    tag: tag || undefined,
    limit: PAGE_SIZE,
    offset,
    sort: sortOrder,
  });
  const cancelMut = useCancelJob();
  const retryMut = useRetryJob();
  const resumeMut = useResumeJob();
  const bulkCancel = useBulkCancelJobs();
  const bulkRetry = useBulkRetryJobs();
  const bulkDelete = useBulkDeleteJobs();

  const jobs = data?.data ?? [];
  const total = data?.total ?? 0;
  const jobIds = jobs.map((j) => j.id);
  const { data: auditCounts } = useAuditCounts(jobIds);

  const running = new Set(activeRuns?.map((r) => r.job_id));

  function filterBy(key: 'status' | 'task_type' | 'tag', value: string) {
    setParams(value ? { [key]: value } : {}, { replace: true });
    setOffset(0);
    setSelected(new Set());
  }

  const allSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // Only what is on screen is acted on.
  const selectedIds = jobs.map(({ id }) => id).filter((id) => selected.has(id));
  const hasSelection = selectedIds.length > 0;

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isBlocking(error, data)) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Jobs</h2>
        <select value={filter} onChange={(e) => filterBy('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'all'}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="or by exact task type..."
          value={taskType}
          onChange={(e) => filterBy('task_type', e.target.value)}
        />
        <input
          type="text"
          placeholder="or by exact tag..."
          value={tag}
          onChange={(e) => filterBy('tag', e.target.value)}
        />
        <SortSelect value={sortOrder} onChange={(v) => { setSortOrder(v); setOffset(0); }} />
      </div>
      <StaleNote error={error} since={dataUpdatedAt} />
      {offset === 0 && <ChangesNote kind="jobs" since={dataUpdatedAt} onRefresh={refetch} />}

      {/* Bulk actions toolbar */}
      {!readOnly && hasSelection && (
        <div className="bulk-toolbar">
          <span className="bulk-count">{selectedIds.length} selected</span>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Cancel ${selectedIds.length} job(s)?`)) {
                bulkCancel.mutate({ ids: selectedIds });
                setSelected(new Set());
              }
            }}
            disabled={bulkCancel.isPending}
          >
            Cancel Selected
          </button>
          <button
            className="btn btn-sm"
            onClick={() => { bulkRetry.mutate({ ids: selectedIds }); setSelected(new Set()); }}
            disabled={bulkRetry.isPending}
          >
            Retry Selected
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Delete ${selectedIds.length} job(s)?`)) {
                bulkDelete.mutate({ ids: selectedIds });
                setSelected(new Set());
              }
            }}
            disabled={bulkDelete.isPending}
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Bulk by status */}
      {!readOnly && filter && !hasSelection && (
        <div className="bulk-toolbar">
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Cancel ${filter} jobs, up to 100 at a time?`)) {
                bulkCancel.mutate({ ids: [], status: filter });
              }
            }}
            disabled={bulkCancel.isPending}
          >
            Cancel All {filter}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => bulkRetry.mutate({ ids: [], status: filter })}
            disabled={bulkRetry.isPending}
          >
            Retry All {filter}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (confirm(`Delete ${filter} jobs, up to 100 at a time?`)) {
                bulkDelete.mutate({ ids: [], status: filter });
              }
            }}
            disabled={bulkDelete.isPending}
          >
            Delete All {filter}
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            {!readOnly && (
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
            )}
            <th>ID</th>
            <th>TaskType</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Schedule</th>
            <th>Attempt</th>
            <th>Runs</th>
            <th>Audit</th>
            <th>Updated</th>
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} onClick={() => navigate(`/jobs/${j.id}`)} className="clickable">
              {!readOnly && (
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(j.id)}
                    onChange={() => toggleOne(j.id)}
                  />
                </td>
              )}
              <td><CopyId id={j.id} /></td>
              <td>
                {j.task_type}
                {j.unique_key && <span className="sub">{j.unique_key}</span>}
                {showPayload && j.payload != null && <span className="sub mono payload">{JSON.stringify(j.payload)}</span>}
              </td>
              <td><PriorityBadge priority={j.priority} /></td>
              <td>
                <span className={`badge badge-${j.status}`}>{j.status}</span>
                {running.has(j.id) && <span className="sub">running</span>}
              </td>
              <td>{j.schedule.type}</td>
              <td>{j.attempt}</td>
              <td>{j.run_count ?? '-'}</td>
              <td>{auditCounts?.[j.id] ?? '-'}</td>
              <td>{timeAgo(j.updated_at)}</td>
              {!readOnly && (
                <td onClick={(e) => e.stopPropagation()}>
                  {!isTerminal(j.status) && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => cancelMut.mutate(j.id)}
                      disabled={cancelMut.isPending}
                    >
                      Cancel
                    </button>
                  )}
                  {j.status === 'paused' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => resumeMut.mutate(j.id)}
                      disabled={resumeMut.isPending}
                    >
                      Resume
                    </button>
                  )}
                  {isRetryable(j.status) && (
                    <button
                      className="btn btn-sm"
                      onClick={() => retryMut.mutate(j.id)}
                      disabled={retryMut.isPending}
                    >
                      Retry
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={readOnly ? 9 : 11} className="empty">
                No jobs found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
    </div>
  );
}
