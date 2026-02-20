import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useBatches, useCancelBatch, useBulkCancelBatches, useBulkRetryBatches, useBulkDeleteBatches } from '../hooks';
import { useSettings } from '../context/SettingsContext';
import { timeAgo } from '../util';
import { PriorityBadge } from '../components/PriorityBadge';
import { Pagination, SortSelect } from '../components/Pagination';

const STATUSES = ['', 'pending', 'running', 'completed', 'failed', 'cancelled'];
const PAGE_SIZE = 10;

function isTerminal(status: string): boolean {
  return ['completed', 'cancelled'].includes(status);
}

export default function Batches() {
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data, isLoading, error } = useBatches({
    status: filter || undefined,
    limit: PAGE_SIZE,
    offset,
    sort: sortOrder,
  });
  const cancelMut = useCancelBatch();
  const bulkCancel = useBulkCancelBatches();
  const bulkRetry = useBulkRetryBatches();
  const bulkDelete = useBulkDeleteBatches();

  const batches = data?.data ?? [];
  const total = data?.total ?? 0;

  const allSelected = batches.length > 0 && batches.every((b) => selected.has(b.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(batches.map((b) => b.id)));
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
        <h2>Batches</h2>
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
              if (confirm(`Delete ${selectedIds.length} batch(es)?`)) {
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
              if (confirm(`Delete all ${filter} batches?`)) {
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
            <th>Priority</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Failed</th>
            <th>Policy</th>
            <th>Created</th>
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => {
            const done = b.completed_items + b.failed_items;
            return (
              <tr key={b.id} onClick={() => navigate(`/batches/${b.id}`)} className="clickable">
                {!readOnly && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleOne(b.id)}
                    />
                  </td>
                )}
                <td className="mono">{b.id.substring(0, 12)}...</td>
                <td>{b.name}</td>
                <td><PriorityBadge priority={b.definition.default_priority} /></td>
                <td>
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                </td>
                <td>
                  <div className="progress-inline">
                    <div className="progress-bar-sm">
                      <div
                        className="progress-fill-sm"
                        style={{ width: b.total_items > 0 ? `${(done / b.total_items) * 100}%` : '0%' }}
                      />
                    </div>
                    <span>{done}/{b.total_items}</span>
                  </div>
                </td>
                <td>{b.failed_items > 0 ? <span className="error-text">{b.failed_items}</span> : '0'}</td>
                <td>{b.definition.failure_policy || 'continue_on_error'}</td>
                <td>{timeAgo(b.created_at)}</td>
                {!readOnly && (
                  <td onClick={(e) => e.stopPropagation()}>
                    {!isTerminal(b.status) && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => cancelMut.mutate(b.id)}
                        disabled={cancelMut.isPending}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {batches.length === 0 && (
            <tr>
              <td colSpan={readOnly ? 8 : 10} className="empty">
                No batches found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
    </div>
  );
}
