import { useNodes, useActiveRuns, useDrainingNodes, useDrainNode, useUndrainNode } from '../hooks';
import { useSettings } from '../context/useSettings';
import { useNow } from '../context/useNow';
import { timeAgo, isBlocking } from '../util';
import type { NodeInfo } from '../api';
import { StaleNote } from '../components/Freshness';

function heartbeatClass(lastHeartbeat: string, now: number): string {
  const elapsed = now - new Date(lastHeartbeat).getTime();
  if (elapsed > 30_000) return 'heartbeat-dead';
  if (elapsed > 15_000) return 'heartbeat-stale';
  return 'heartbeat-healthy';
}

function HeartbeatDot({ node }: { node: NodeInfo }) {
  const cls = heartbeatClass(node.last_heartbeat, useNow());
  return (
    <span className={`heartbeat-dot ${cls}`}>
      <span className="dot-pulse" />
      {timeAgo(node.last_heartbeat)}
    </span>
  );
}

/** Which node can run what. A task type that some node lacks may wait for the others. */
function HandlerCoverage({ nodes }: { nodes: NodeInfo[] }) {
  const taskTypes = [...new Set(nodes.flatMap((n) => n.task_types ?? []))].sort();
  return (
    <>
      <h3>Handlers</h3>
      <table className="coverage">
        <thead>
          <tr>
            <th>Task Type</th>
            {nodes.map((n) => <th key={n.node_id}>{n.node_id}</th>)}
          </tr>
        </thead>
        <tbody>
          {taskTypes.map((t) => {
            const versions = new Set(nodes.flatMap((n) => n.handler_versions?.[t] ?? []));
            return (
              <tr key={t}>
                <td>
                  {t}
                  {versions.size > 1 && <span className="sub error-text">{versions.size} versions: a message is taken by a node of its version</span>}
                </td>
                {nodes.map((n) => (
                  <td key={n.node_id}>
                    {n.task_types?.includes(t) ? n.handler_versions?.[t] ?? <span role="img" aria-label="yes">✓</span> : <span className="missing">no</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

export default function Nodes() {
  const { data: nodes, isLoading, error, dataUpdatedAt } = useNodes();
  const { readOnly } = useSettings();
  const { data: activeRuns } = useActiveRuns();
  const draining = useDrainingNodes(nodes ?? []);
  const drainMut = useDrainNode();
  const undrainMut = useUndrainNode();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isBlocking(error, nodes)) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <h2>Nodes</h2>
      <StaleNote error={error} since={dataUpdatedAt} />
      <p className="hint">Started counts the runs since the node came up, retries among them.</p>

      <table>
        <thead>
          <tr>
            <th>Node ID</th>
            <th>Workers</th>
            <th>Active Runs</th>
            <th>Started</th>
            <th>Task Types</th>
            <th>Status</th>
            <th>Up Since</th>
            <th>Heartbeat</th>
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {nodes?.map((n) => (
            <tr key={n.node_id}>
              <td className="mono">{n.node_id}</td>
              <td>
                {n.pool_stats ? (
                  <div className="progress-inline">
                    <div className="progress-bar-sm">
                      <div
                        className="progress-fill-sm"
                        style={{ width: `${(n.pool_stats.running_workers / Math.max(1, n.pool_stats.max_concurrency)) * 100}%` }}
                      />
                    </div>
                    <span>{n.pool_stats.running_workers}/{n.pool_stats.max_concurrency}</span>
                  </div>
                ) : '-'}
              </td>
              <td>{activeRuns?.filter((r) => r.node_id === n.node_id).length ?? n.active_run_ids?.length ?? 0}</td>
              <td>
                {n.pool_stats ? (
                  <>
                    {n.pool_stats.total_submitted.toLocaleString()}
                    <span className="sub">
                      {n.pool_stats.total_completed.toLocaleString()} completed, {n.pool_stats.total_failed.toLocaleString()} failed
                    </span>
                  </>
                ) : '-'}
              </td>
              <td>{n.task_types?.length ?? 0}</td>
              <td>
                {draining.has(n.node_id)
                  ? <span className="badge badge-cancelled">Draining</span>
                  : <span className="badge badge-running">Active</span>}
              </td>
              <td>{timeAgo(n.started_at)}</td>
              <td><HeartbeatDot node={n} /></td>
              {!readOnly && (
                <td>
                  {draining.has(n.node_id) ? (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => undrainMut.mutate(n.node_id)}
                      disabled={undrainMut.isPending}
                    >
                      Undrain
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => {
                        if (confirm(`Drain ${n.node_id}? It finishes its runs and takes no new ones.`)) drainMut.mutate(n.node_id);
                      }}
                      disabled={drainMut.isPending}
                    >
                      Drain
                    </button>
                  )}
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

      {nodes && nodes.length > 0 && <HandlerCoverage nodes={nodes} />}
    </div>
  );
}
