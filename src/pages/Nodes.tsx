import { useNodes, useDrainNode, useUndrainNode } from '../hooks';
import { useSettings } from '../context/useSettings';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
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

function DrainBadge({ nodeId }: { nodeId: string }) {
  const { data } = useQuery({
    queryKey: ['nodeDrain', nodeId],
    queryFn: () => api.getNodeDrainStatus(nodeId),
    refetchInterval: 10000,
  });
  if (!data) return <span className="badge badge-running">Active</span>;
  return data.draining
    ? <span className="badge badge-cancelled">Draining</span>
    : <span className="badge badge-running">Active</span>;
}

export default function Nodes() {
  const { data: nodes, isLoading, error } = useNodes();
  const { readOnly } = useSettings();
  const drainMut = useDrainNode();
  const undrainMut = useUndrainNode();

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
            <th>Status</th>
            <th>Heartbeat</th>
            {!readOnly && <th>Actions</th>}
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
              <td><DrainBadge nodeId={n.node_id} /></td>
              <td><HeartbeatDot node={n} /></td>
              {!readOnly && (
                <td>
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => drainMut.mutate(n.node_id)}
                    disabled={drainMut.isPending}
                  >
                    Drain
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ marginLeft: '0.25rem' }}
                    onClick={() => undrainMut.mutate(n.node_id)}
                    disabled={undrainMut.isPending}
                  >
                    Undrain
                  </button>
                </td>
              )}
            </tr>
          ))}
          {nodes?.length === 0 && (
            <tr>
              <td colSpan={!readOnly ? 9 : 8} className="empty">
                No nodes
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
