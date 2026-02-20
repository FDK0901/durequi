import { useState, useMemo } from 'react';
import { useHistoryRuns } from '../hooks';
import { timeAgo } from '../util';
import { Pagination, SortSelect } from '../components/Pagination';

const PAGE_SIZE = 30;

const STATUSES = ['', 'succeeded', 'failed', 'running'];

function formatDuration(ns: number): string {
  if (!ns) return '-';
  const ms = ns / 1_000_000;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function Runs() {
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobIdFilter, setJobIdFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const params = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      sort: sortOrder,
      status: statusFilter || undefined,
      job_id: jobIdFilter || undefined,
    }),
    [offset, sortOrder, statusFilter, jobIdFilter],
  );

  const { data, isLoading, error } = useHistoryRuns(params);
  const runs = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Execution History</h2>
        <input
          type="text"
          placeholder="Filter by Job ID..."
          value={jobIdFilter}
          onChange={(e) => {
            setJobIdFilter(e.target.value);
            setOffset(0);
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setOffset(0);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'all'}
            </option>
          ))}
        </select>
        <SortSelect value={sortOrder} onChange={(v) => { setSortOrder(v); setOffset(0); }} />
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          {total === 0 && !statusFilter && !jobIdFilter
            ? 'No run history yet.'
            : 'No runs match the current filters.'}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Job ID</th>
                <th>Node</th>
                <th>Status</th>
                <th>Attempt</th>
                <th>Duration</th>
                <th>Started</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id.substring(0, 12)}...</td>
                  <td className="mono">{r.job_id.substring(0, 12)}...</td>
                  <td>{r.node_id}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                  <td>{r.attempt}</td>
                  <td>{formatDuration(r.duration)}</td>
                  <td>{timeAgo(r.started_at)}</td>
                  <td className="error-cell">{r.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
        </>
      )}
    </div>
  );
}
