import { useState } from 'react';
import { useStats, useDailyStats, useSyncRetries } from '../hooks';
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

const STATUS_ORDER = [
  'pending',
  'scheduled',
  'running',
  'completed',
  'failed',
  'retrying',
  'dead',
  'cancelled',
];

type Period = 7 | 30 | 90;

export default function Dashboard() {
  const { data: stats, isLoading, error } = useStats();
  const [period, setPeriod] = useState<Period>(7);
  const { data: dailyStats } = useDailyStats(period);
  const { data: syncRetries } = useSyncRetries();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!stats) return null;

  return (
    <div className="page">
      <h2>Cluster Overview</h2>

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
          <div className="stat-label">Active Runs</div>
        </div>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)} // "MM-DD"
                stroke="#888"
                fontSize={12}
              />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #444', borderRadius: 6 }}
                labelStyle={{ color: '#ccc' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="processed"
                stackId="1"
                stroke="#4ade80"
                fill="#4ade8040"
                name="Processed"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="1"
                stroke="#f87171"
                fill="#f8717140"
                name="Failed"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted">No daily stats available yet.</p>
        )}
      </div>

      <h3>Jobs by Status</h3>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_ORDER.map((s) => (
            <tr key={s}>
              <td>
                <span className={`badge badge-${s}`}>{s}</span>
              </td>
              <td>{stats.job_counts[s] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
