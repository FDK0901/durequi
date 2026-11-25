import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useActiveRuns, useHistoryRuns } from '../hooks';
import { formatNs, mergeRuns, timeAgo } from '../util';
import { Pagination, SortSelect } from '../components/Pagination';
import { RunDrawer, RunDrawerById } from '../components/RunDrawer';
import { NodeLanes } from '../components/charts/NodeLanes';
import type { JobRun } from '../api';

const PAGE_SIZE = 50;

const STATUSES = ['', 'succeeded', 'failed', 'timed_out', 'cancelled'];

export default function Runs() {
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobIdFilter, setJobIdFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [picked, setPicked] = useState<JobRun | null>(null);
  const [search, setSearch] = useSearchParams();
  const runId = search.get('run') ?? '';
  const [runIdDraft, setRunIdDraft] = useState(runId);
  const navigate = useNavigate();

  function lookUp(id: string) {
    setRunIdDraft(id);
    setSearch(id ? { run: id } : {}, { replace: true });
  }

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
  const { data: activeRuns } = useActiveRuns();
  const active = (activeRuns ?? []).filter((r) => !jobIdFilter || r.job_id === jobIdFilter);
  // The API goes by the job alone if one is given.
  const found = data?.data ?? [];
  const runs = statusFilter && jobIdFilter ? found.filter((r) => r.status === statusFilter) : found;
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
        <input
          type="text"
          placeholder="Look up a Run ID..."
          value={runIdDraft}
          onChange={(e) => setRunIdDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookUp(runIdDraft.trim())}
        />
        <button className="btn" onClick={() => lookUp(runIdDraft.trim())} disabled={!runIdDraft.trim()}>Look Up</button>
      </div>

      {statusFilter && jobIdFilter && runs.length < found.length && (
        <p className="hint">{found.length - runs.length} runs of this job on this page have another status and are left out.</p>
      )}

      {!statusFilter && sortOrder === 'newest' && offset === 0 && runs.length + active.length > 0 && (
        <div className="chart-section">
          <div className="chart-header"><h3>Runs by Node</h3></div>
          <NodeLanes runs={mergeRuns(active, runs)} onRun={setPicked} />
        </div>
      )}

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
                <tr key={r.id} className="clickable" onClick={() => setPicked(r)}>
                  <td className="mono">{r.id.substring(0, 12)}...</td>
                  <td className="mono" onClick={(e) => e.stopPropagation()}>
                    <span className="link" onClick={() => navigate(`/jobs/${r.job_id}`)}>{r.job_id.substring(0, 12)}...</span>
                  </td>
                  <td>{r.node_id}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                  <td>{r.attempt}</td>
                  <td>{formatNs(r.duration)}</td>
                  <td>{timeAgo(r.started_at)}</td>
                  <td className="error-cell">{r.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
        </>
      )}
      {picked
        ? <RunDrawer run={picked} onClose={() => setPicked(null)} />
        : runId && <RunDrawerById id={runId} onClose={() => lookUp('')} />}
    </div>
  );
}
