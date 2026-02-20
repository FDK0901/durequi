import { useNodes } from '../hooks';
import { timeAgo } from '../util';
import type { NodeInfo } from '../api';

function heartbeatClass(lastHeartbeat: string): string {
  const elapsed = Date.now() - new Date(lastHeartbeat).getTime();
  if (elapsed > 30_000) return 'heartbeat-dead';
  if (elapsed > 15_000) return 'heartbeat-stale';
  return 'heartbeat-healthy';
}

function HeartbeatDot({ node }: { node: NodeInfo }) {
  const cls = heartbeatClass(node.last_heartbeat);
  return (
    <span className={`heartbeat-dot ${cls}`}>
      <span className="dot-pulse" />
      {timeAgo(node.last_heartbeat)}
    </span>
  );
}

export default function Nodes() {
  const { data: nodes, isLoading, error } = useNodes();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <h2>Nodes</h2>

      <table>
        <thead>
          <tr>
            <th>Node ID</th>
            <th>Task Types</th>
            <th>Workers</th>
            <th>Active Runs</th>
            <th>Completed</th>
            <th>Failed</th>
            <th>Heartbeat</th>
          </tr>
        </thead>
        <tbody>
          {nodes?.map((n) => (
            <tr key={n.node_id}>
              <td className="mono">{n.node_id}</td>
              <td>{n.task_types?.join(', ') || '-'}</td>
              <td>
                {n.pool_stats
                  ? `${n.pool_stats.running_workers}/${n.pool_stats.max_concurrency}`
                  : '-'}
              </td>
              <td>{n.active_run_ids?.length ?? 0}</td>
              <td>{n.pool_stats?.total_completed ?? '-'}</td>
              <td>{n.pool_stats?.total_failed ?? '-'}</td>
              <td><HeartbeatDot node={n} /></td>
            </tr>
          ))}
          {nodes?.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                No nodes
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
