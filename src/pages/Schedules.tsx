import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSchedules, useActiveRuns, useJobsById, useRunsOfJobs } from '../hooks';
import { describeOverlap, describeSchedule, formatNs, mergeRuns, shortId, timeAgo } from '../util';
import { Pagination } from '../components/Pagination';
import { RunDrawer } from '../components/RunDrawer';
import { FiringBoard, type BoardRow } from '../components/charts/FiringBoard';
import { RunStrip } from '../components/charts/RunStrip';
import type { JobRun } from '../api';

const PAGE_SIZE = 10;
const RUN_LIMIT = 100;

const SPANS = [
  { label: '2m', value: 2 * 60_000 },
  { label: '15m', value: 15 * 60_000 },
  { label: '1h', value: 3_600_000 },
  { label: '6h', value: 6 * 3_600_000 },
  { label: '24h', value: 24 * 3_600_000 },
];

function ScheduleRunHistory({ runs, onRun }: { runs: JobRun[]; onRun: (run: JobRun) => void }) {
  if (runs.length === 0) {
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
          <tr key={r.id} className="clickable" onClick={() => onRun(r)}>
            <td className="mono">{r.id.substring(0, 12)}...</td>
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
  );
}

export default function Schedules() {
  const [offset, setOffset] = useState(0);
  const [span, setSpan] = useState(15 * 60_000);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [picked, setPicked] = useState<JobRun | null>(null);
  const navigate = useNavigate();
  // The order is that of the next firing: "oldest" is what is due first.
  const { data, isLoading, error } = useSchedules({
    limit: PAGE_SIZE,
    offset,
    sort: 'oldest',
  });
  const { data: activeRuns } = useActiveRuns();

  const schedules = data?.data ?? [];
  const total = data?.total ?? 0;
  const ids = schedules.map((s) => s.job_id).sort();
  const jobs = useJobsById(ids);
  const runs = useRunsOfJobs(ids, RUN_LIMIT);

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  // Rows keep their place, while what is due first changes all the time.
  const rows: BoardRow[] = schedules
    .map((entry) => ({
      entry,
      job: jobs.get(entry.job_id),
      runs: mergeRuns(activeRuns?.filter((r) => r.job_id === entry.job_id) ?? [], runs.get(entry.job_id) ?? []),
    }))
    .sort((a, b) => a.entry.job_id.localeCompare(b.entry.job_id));

  return (
    <div className="page">
      <h2>Active Schedules</h2>

      {rows.length > 0 && (
        <div className="chart-section">
          <div className="chart-header">
            <h3>Firings</h3>
            <div className="period-selector">
              {SPANS.map((o) => (
                <button
                  key={o.value}
                  className={`btn btn-sm ${span === o.value ? 'btn-primary' : ''}`}
                  onClick={() => setSpan(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <FiringBoard rows={rows} span={span} runLimit={RUN_LIMIT} onRun={setPicked} />
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Status</th>
            <th>Spec</th>
            <th>Next Run</th>
            <th>Last Runs</th>
            <th>Runs</th>
            <th>On Failure</th>
            <th>History</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry: s, job, runs }) => (
            <Fragment key={s.job_id}>
              <tr className="clickable" onClick={() => navigate(`/jobs/${s.job_id}`)}>
                <td>
                  {job?.task_type ?? shortId(s.job_id, 16)}
                  <span className="sub">{job?.unique_key ?? shortId(s.job_id, 16)}</span>
                </td>
                <td>{job && <span className={`badge badge-${job.status}`}>{job.status}</span>}</td>
                <td>
                  {describeSchedule(s.schedule)}
                  <span className="sub">
                    {s.schedule.timezone || 'UTC'}
                    {s.schedule.overlap_policy && `, ${describeOverlap(s.schedule)}`}
                  </span>
                </td>
                <td>{new Date(s.next_run_at).toLocaleString()}</td>
                <td><RunStrip runs={runs} /></td>
                <td>{job?.run_count ?? '-'}</td>
                <td>{s.schedule.type === 'ONE_TIME' ? '-' : s.schedule.keep_on_failure ? 'keeps going' : 'goes dead'}</td>
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
                <tr>
                  <td colSpan={8} style={{ padding: '0.5rem 1rem', background: 'var(--surface)' }}>
                    <h3 style={{ margin: '0.5rem 0' }}>Recent Runs</h3>
                    <ScheduleRunHistory runs={runs.slice(0, 20)} onRun={setPicked} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {schedules.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                No active schedules
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
      {picked && <RunDrawer run={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}
