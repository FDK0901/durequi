import { useState } from 'react';
import { Link } from 'react-router';
import { useStats, useDailyStats, useSyncRetries, useNodes, useQueues, useJobsById, useSchedules, useDLQ } from '../hooks';
import { useNow } from '../context/useNow';
import { LATE_MS, describeSchedule, formatDue, shortId, isBlocking } from '../util';
import { ActivityFeed } from '../components/ActivityFeed';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { StaleNote } from '../components/Freshness';

const STATUS_ORDER = [
  'pending',
  'scheduled',
  'completed',
  'failed',
  'retrying',
  'paused',
  'dead',
  'cancelled',
];

type Period = 7 | 30 | 90;

const STALE_MS = 30_000;

interface AttentionItem {
  tone: string;
  count?: number;
  what: [one: string, many: string];
  note?: string;
  to: string;
}

/** What someone should look at, most urgent first. */
function Attention() {
  const now = useNow();
  const { data: stats } = useStats();
  const { data: dlq } = useDLQ({ limit: 1 });
  const { data: nodes } = useNodes();
  const { data: queues } = useQueues();
  const { data: sync } = useSyncRetries();
  const { data: due } = useSchedules({ limit: 20, sort: 'oldest' });

  const all: AttentionItem[] = [
    {
      tone: 'failed', to: '/schedules', note: 'Is a node running the scheduler?',
      count: due?.data?.filter((s) => now - new Date(s.next_run_at).getTime() > LATE_MS).length,
      what: ['schedule is late', 'schedules are late'],
    },
    {
      tone: 'failed', to: '/nodes', note: `For more than ${STALE_MS / 1000} seconds`,
      count: nodes?.filter((n) => now - new Date(n.last_heartbeat).getTime() > STALE_MS).length,
      what: ['node without a heartbeat', 'nodes without a heartbeat'],
    },
    { tone: 'failed', to: '/redis', count: sync?.failed, what: ['write to Redis was given up', 'writes to Redis were given up'] },
    { tone: 'failed', to: '/jobs?status=dead', count: stats?.job_counts.dead, what: ['dead job', 'dead jobs'], note: 'Retries used up, or a non-retryable error' },
    { tone: 'failed', to: '/workflows?status=failed', count: stats?.workflow_counts?.failed, what: ['failed workflow', 'failed workflows'] },
    { tone: 'failed', to: '/batches?status=failed', count: stats?.batch_counts?.failed, what: ['failed batch', 'failed batches'] },
    { tone: 'retrying', to: '/dlq', count: dlq?.total, what: ['message in the DLQ', 'messages in the DLQ'], note: 'Executions that were given up' },
    { tone: 'paused', to: '/jobs?status=paused', count: stats?.job_counts.paused, what: ['paused job', 'paused jobs'] },
    { tone: 'paused', to: '/workflows?status=suspended', count: stats?.workflow_counts?.suspended, what: ['suspended workflow', 'suspended workflows'] },
    { tone: 'paused', to: '/queues', count: queues?.filter((q) => q.paused).length, what: ['paused queue', 'paused queues'] },
  ];
  const items = all.filter((i) => i.count);

  if (items.length === 0) return <p className="muted">Nothing right now.</p>;
  return (
    <ul className="plain-list">
      {items.map((i) => (
        <li key={i.what[0]}>
          <i className={`swatch tone-${i.tone}`} />
          <Link className="grow" to={i.to}>
            {i.count!.toLocaleString()} {i.what[i.count === 1 ? 0 : 1]}
            {i.note && <span className="sub">{i.note}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NextFirings() {
  const now = useNow();
  const { data } = useSchedules({ limit: 6, sort: 'oldest' });
  const schedules = data?.data ?? [];
  const jobs = useJobsById(schedules.map((s) => s.job_id));

  if (schedules.length === 0) return <p className="muted">No schedules.</p>;
  return (
    <ul className="plain-list">
      {schedules.map((s) => {
        const ms = new Date(s.next_run_at).getTime() - now;
        return (
          <li key={s.job_id}>
            <Link className="grow" to={`/jobs/${s.job_id}`}>
              {jobs.get(s.job_id)?.task_type ?? shortId(s.job_id)}
              <span className="sub">{describeSchedule(s.schedule)}</span>
            </Link>
            {formatDue(ms)}
          </li>
        );
      })}
    </ul>
  );
}

/** Counts by status, with a bar on a common scale. */
function StatusTable({ title, rows, to }: { title: string; rows: [string, number][]; to: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th style={{ width: '45%' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map(([s, n]) => (
            <tr key={s}>
              <td>
                <Link to={`${to}?status=${s}`}><span className={`badge badge-${s}`}>{s}</span></Link>
              </td>
              <td>{n.toLocaleString()}</td>
              <td style={{ verticalAlign: 'middle' }}>
                {n > 0 && <div className={`status-bar tone-${s}`} style={{ width: `${(n / max) * 100}%` }} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error, dataUpdatedAt } = useStats();
  const { data: nodes } = useNodes();
  const { data: queues } = useQueues();
  const [period, setPeriod] = useState<Period>(7);
  const { data: dailyStats } = useDailyStats(period);
  const { data: syncRetries } = useSyncRetries();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isBlocking(error, stats)) return <div className="error">Error: {error.message}</div>;
  if (!stats) return null;

  const capacity = nodes?.reduce((n, node) => n + (node.pool_stats?.max_concurrency ?? 0), 0) ?? 0;
  const busy = nodes?.reduce((n, node) => n + (node.pool_stats?.running_workers ?? 0), 0) ?? 0;
  const waiting = queues?.reduce((n, q) => n + (q.waiting ?? 0), 0) ?? 0;
  const today = dailyStats?.[dailyStats.length - 1];
  const attempts = today ? today.processed + today.failed : 0;

  return (
    <div className="page">
      <h2>Cluster Overview</h2>
      <StaleNote error={error} since={dataUpdatedAt} />

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.active_nodes}</div>
          <div className="stat-label">Active Nodes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active_schedules}</div>
          <div className="stat-label">Active Schedules</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active_runs}</div>
          <div className="stat-label">
            Active Runs
            {waiting > 0 && <Link className="sub" to="/queues">{waiting.toLocaleString()} waiting</Link>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{busy}/{capacity}</div>
          <div className="stat-label">Workers Busy</div>
        </div>
        {today && attempts > 0 && (
          <div className="stat-card">
            <div className="stat-value" title="Share of the attempts that succeeded">{((today.processed / attempts) * 100).toFixed(1)}%</div>
            <div className="stat-label">Success Today</div>
          </div>
        )}
        {stats.active_workflows != null && (
          <div className="stat-card">
            <div className="stat-value">{stats.active_workflows}</div>
            <div className="stat-label">Active Workflows</div>
          </div>
        )}
        {stats.active_batches != null && (
          <div className="stat-card">
            <div className="stat-value">{stats.active_batches}</div>
            <div className="stat-label">Active Batches</div>
          </div>
        )}
        {syncRetries && (syncRetries.pending > 0 || syncRetries.failed > 0) && (
          <div className={`stat-card ${syncRetries.failed > 0 ? 'stat-card-danger' : 'stat-card-warning'}`}>
            <div className="stat-value">
              {syncRetries.pending > 0 && <span title="Pending retries">{syncRetries.pending} pending</span>}
              {syncRetries.pending > 0 && syncRetries.failed > 0 && ' / '}
              {syncRetries.failed > 0 && <span title="Failed retries">{syncRetries.failed} failed</span>}
            </div>
            <div className="stat-label">Sync Retries</div>
          </div>
        )}
      </div>

      {/* Daily Stats Chart */}
      <div className="chart-section">
        <div className="chart-header">
          <h3>Tasks Processed</h3>
          <div className="period-selector">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                className={`btn btn-sm ${period === p ? 'btn-primary' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        {dailyStats && dailyStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)} // "MM-DD"
                stroke="var(--ink-3)"
                fontSize={12}
              />
              <YAxis stroke="var(--ink-3)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6 }}
                labelStyle={{ color: 'var(--ink-2)' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="processed"
                stackId="1"
                stroke="var(--ok)"
                fill="var(--ok)"
                fillOpacity={0.25}
                name="Processed"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="1"
                stroke="var(--bad)"
                fill="var(--bad)"
                fillOpacity={0.25}
                name="Failed"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted">No daily stats available yet.</p>
        )}
      </div>

      <div className="dash-columns">
        <div className="chart-section">
          <div className="chart-header"><h3>Needs Attention</h3></div>
          <Attention />
        </div>
        <div className="chart-section">
          <div className="chart-header">
            <h3>Next Firings</h3>
            <Link className="link" to="/schedules">All schedules</Link>
          </div>
          <NextFirings />
        </div>
        <div className="chart-section">
          <div className="chart-header">
            <h3>Live Activity</h3>
            <Link className="link" to="/events">All events</Link>
          </div>
          <ActivityFeed />
        </div>
      </div>

      <div className="dash-columns">
        <StatusTable
          title="Jobs by Status"
          to="/jobs"
          rows={STATUS_ORDER.map((s) => [s, stats.job_counts[s] ?? 0])}
        />
        {stats.workflow_counts && Object.keys(stats.workflow_counts).length > 0 && (
          <StatusTable title="Workflows by Status" to="/workflows" rows={Object.entries(stats.workflow_counts)} />
        )}
        {stats.batch_counts && Object.keys(stats.batch_counts).length > 0 && (
          <StatusTable title="Batches by Status" to="/batches" rows={Object.entries(stats.batch_counts)} />
        )}
      </div>
    </div>
  );
}
