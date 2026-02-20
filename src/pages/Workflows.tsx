import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useWorkflows, useCancelWorkflow, useRetryWorkflow, useBulkCancelWorkflows, useBulkRetryWorkflows, useBulkDeleteWorkflows } from '../hooks';
import { useSettings } from '../context/SettingsContext';
import { timeAgo } from '../util';
import { Pagination, SortSelect } from '../components/Pagination';

const STATUSES = ['', 'pending', 'running', 'completed', 'failed', 'cancelled'];
const PAGE_SIZE = 10;

function isTerminal(status: string): boolean {
  return ['completed', 'cancelled'].includes(status);
}

export default function Workflows() {
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data, isLoading, error } = useWorkflows({
    status: filter || undefined,
    limit: PAGE_SIZE,
    offset,
    sort: sortOrder,
  });
  const cancelMut = useCancelWorkflow();
  const retryMut = useRetryWorkflow();
  const bulkCancel = useBulkCancelWorkflows();
  const bulkRetry = useBulkRetryWorkflows();
  const bulkDelete = useBulkDeleteWorkflows();

  const workflows = data?.data ?? [];
  const total = data?.total ?? 0;

  const allSelected = workflows.length > 0 && workflows.every((w) => selected.has(w.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(workflows.map((w) => w.id)));
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
        <h2>Workflows</h2>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setOffset(0); setSelected(new Set()); }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'all'}
            </option>
          ))}
        </select>
        <SortSelect value={sortOrder} onChange={(v) => { setSortOrder(v); setOffset(0); }} />
      </div>

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
              if (confirm(`Delete ${selectedIds.length} workflow(s)?`)) {
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
              if (confirm(`Delete all ${filter} workflows?`)) {
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
            <th>Name</th>
            <th>Status</th>
            <th>Tasks</th>
            <th>Created</th>
            <th>Updated</th>
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {workflows.map((wf) => {
            const taskStates = Object.values(wf.tasks ?? {});
            const completed = taskStates.filter((t) => t.status === 'completed').length;
            const taskTotal = taskStates.length;

            return (
              <tr key={wf.id} onClick={() => navigate(`/workflows/${wf.id}`)} className="clickable">
                {!readOnly && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(wf.id)}
                      onChange={() => toggleOne(wf.id)}
                    />
                  </td>
                )}
                <td className="mono">{wf.id.substring(0, 12)}...</td>
                <td>{wf.workflow_name}</td>
                <td>
                  <span className={`badge badge-${wf.status}`}>{wf.status}</span>
                </td>
                <td>{completed}/{taskTotal}</td>
                <td>{timeAgo(wf.created_at)}</td>
                <td>{timeAgo(wf.updated_at)}</td>
                {!readOnly && (
                  <td onClick={(e) => e.stopPropagation()}>
                    {!isTerminal(wf.status) && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => cancelMut.mutate(wf.id)}
                        disabled={cancelMut.isPending}
                      >
                        Cancel
                      </button>
                    )}
                    {wf.status === 'failed' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => retryMut.mutate(wf.id)}
                        disabled={retryMut.isPending}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {workflows.length === 0 && (
            <tr>
              <td colSpan={readOnly ? 6 : 8} className="empty">
                No workflows found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
    </div>
  );
}
