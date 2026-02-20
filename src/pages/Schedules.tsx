import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSchedules, useJobRuns } from '../hooks';
import { timeAgo } from '../util';
import { Pagination, SortSelect } from '../components/Pagination';
import type { ScheduleEntry } from '../api';

const PAGE_SIZE = 10;

function formatScheduleSpec(s: ScheduleEntry): string {
  const sched = s.schedule;
  if (sched.cron_expr) return `cron: ${sched.cron_expr}`;
  if (sched.interval) return `every ${sched.interval}`;
  if (sched.regular_interval) return `every ${sched.regular_interval}s`;
  if (sched.run_at) return `once at ${new Date(sched.run_at).toLocaleString()}`;
  return sched.type;
}

function formatDuration(ns: number): string {
  if (!ns) return '-';
  const ms = ns / 1_000_000;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ScheduleRunHistory({ jobId }: { jobId: string }) {
  const { data: runs } = useJobRuns(jobId, 5);

  if (!runs || runs.length === 0) {
    return <div className="muted" style={{ padding: '0.5rem 0' }}>No execution history yet.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Run ID</th>
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
  );
}

export default function Schedules() {
  const [offset, setOffset] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { data, isLoading, error } = useSchedules({
    limit: PAGE_SIZE,
    offset,
    sort: sortOrder,
  });

  const schedules = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <h2>Active Schedules</h2>
        <SortSelect value={sortOrder} onChange={(v) => { setSortOrder(v); setOffset(0); }} />
      </div>

      <table>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Schedule Type</th>
            <th>Spec</th>
            <th>Next Run</th>
            <th>Timezone</th>
            <th>History</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s) => (
            <>
              <tr key={s.job_id} className="clickable" onClick={() => navigate(`/jobs/${s.job_id}`)}>
                <td className="mono">{s.job_id.substring(0, 16)}...</td>
                <td>{s.schedule.type}</td>
                <td>{formatScheduleSpec(s)}</td>
                <td>{new Date(s.next_run_at).toLocaleString()}</td>
                <td>{s.schedule.timezone || 'UTC'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-sm"
                    onClick={() => setExpandedId(expandedId === s.job_id ? null : s.job_id)}
                  >
                    {expandedId === s.job_id ? 'Hide' : 'Show'}
                  </button>
                </td>
              </tr>
              {expandedId === s.job_id && (
                <tr key={`${s.job_id}-history`}>
                  <td colSpan={6} style={{ padding: '0.5rem 1rem', background: '#161822' }}>
                    <h3 style={{ margin: '0.5rem 0' }}>Recent Runs</h3>
                    <ScheduleRunHistory jobId={s.job_id} />
                  </td>
                </tr>
              )}
            </>
          ))}
          {schedules.length === 0 && (
            <tr>
              <td colSpan={6} className="empty">
                No active schedules
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
    </div>
  );
}
