import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useJobs, useCancelJob, useRetryJob, useBulkCancelJobs, useBulkRetryJobs, useBulkDeleteJobs } from '../hooks';
import { useSettings } from '../context/SettingsContext';
import { timeAgo } from '../util';
import { PriorityBadge } from '../components/PriorityBadge';
import { Pagination, SortSelect } from '../components/Pagination';

const STATUSES = [
  '',
  'pending',
  'scheduled',
  'running',
  'completed',
  'failed',
  'retrying',
  'dead',
  'cancelled',
];

const PAGE_SIZE = 10;

function isTerminal(status: string): boolean {
  return ['completed', 'dead', 'cancelled'].includes(status);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function Jobs() {
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data, isLoading, error } = useJobs({
    status: filter || undefined,
    limit: PAGE_SIZE,
    offset,
    sort: sortOrder,
  });
  const cancelMut = useCancelJob();
  const retryMut = useRetryJob();
  const bulkCancel = useBulkCancelJobs();
  const bulkRetry = useBulkRetryJobs();
  const bulkDelete = useBulkDeleteJobs();

  const jobs = data?.data ?? [];
  const total = data?.total ?? 0;

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

  const selectedIds = Array.from(selected);
  const hasSelection = selectedIds.length > 0;

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Jobs</h2>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setOffset(0); setSelected(new Set()); }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'all'}
            </option>
          ))}
        </select>
        <SortSelect value={sortOrder} onChange={(v) => { setSortOrder(v); setOffset(0); }} />
      </div>

      {/* Bulk actions toolbar */}
      {!readOnly && hasSelection && (
        <div className="bulk-toolbar">
          <span className="bulk-count">{selectedIds.length} selected</span>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => { bulkCancel.mutate({ ids: selectedIds }); setSelected(new Set()); }}
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
            onClick={() => bulkCancel.mutate({ ids: [], status: filter })}
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
              if (confirm(`Delete all ${filter} jobs?`)) {
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
              <td className="mono id-cell">
                <span title={j.id}>{j.id.substring(0, 12)}...</span>
                <button
                  className="btn-copy"
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(j.id); }}
                  title="Copy ID"
                >
                  &nbsp;
                </button>
              </td>
              <td>{j.task_type}</td>
              <td><PriorityBadge priority={j.priority} /></td>
              <td>
                <span className={`badge badge-${j.status}`}>{j.status}</span>
              </td>
              <td>{j.schedule.type}</td>
              <td>{j.attempt}</td>
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
                  {(j.status === 'failed' || j.status === 'dead') && (
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
              <td colSpan={readOnly ? 8 : 9} className="empty">
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
