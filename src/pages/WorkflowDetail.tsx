import { useParams, useNavigate } from 'react-router';
import { useWorkflow, useCancelWorkflow, useRetryWorkflow } from '../hooks';
import { useSettings } from '../context/SettingsContext';
import { timeAgo, formatCountdown } from '../util';
import { JsonView } from '../components/JsonView';
import type { WorkflowInstance, WorkflowTaskDef, WorkflowTaskState } from '../api';

// --- DAG layout helpers ---

interface DagNode {
  name: string;
  def: WorkflowTaskDef;
  state: WorkflowTaskState;
  layer: number;
  col: number;
}

function computeLayers(wf: WorkflowInstance): DagNode[] {
  const defs = new Map(wf.definition.tasks.map((t) => [t.name, t]));

  // Kahn's algorithm to assign layers
  const inDeg = new Map<string, number>();
  const deps = new Map<string, string[]>(); // dep -> dependents
  for (const t of wf.definition.tasks) {
    if (!inDeg.has(t.name)) inDeg.set(t.name, 0);
    for (const d of t.depends_on ?? []) {
      inDeg.set(t.name, (inDeg.get(t.name) ?? 0) + 1);
      if (!deps.has(d)) deps.set(d, []);
      deps.get(d)!.push(t.name);
    }
  }

  const layerMap = new Map<string, number>();
  const queue: string[] = [];
  for (const [name, deg] of inDeg) {
    if (deg === 0) queue.push(name);
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    const layer = layerMap.get(node) ?? 0;
    if (!layerMap.has(node)) layerMap.set(node, 0);
    for (const dep of deps.get(node) ?? []) {
      const newLayer = layer + 1;
      layerMap.set(dep, Math.max(layerMap.get(dep) ?? 0, newLayer));
      inDeg.set(dep, (inDeg.get(dep) ?? 0) - 1);
      if (inDeg.get(dep) === 0) queue.push(dep);
    }
  }

  // Group by layer and assign col positions
  const byLayer = new Map<number, string[]>();
  for (const [name, layer] of layerMap) {
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(name);
  }

  const nodes: DagNode[] = [];
  for (const [layer, names] of byLayer) {
    names.forEach((name, col) => {
      nodes.push({
        name,
        def: defs.get(name)!,
        state: wf.tasks?.[name] ?? { name, status: 'pending' },
        layer,
        col,
      });
    });
  }

  return nodes;
}

const NODE_W = 160;
const NODE_H = 50;
const LAYER_GAP = 80;
const COL_GAP = 40;

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return '#4ade80';
    case 'running': return '#60a5fa';
    case 'failed': case 'dead': return '#f87171';
    case 'cancelled': return '#8b8fa3';
    default: return '#fbbf24';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'completed': return '#0a3622';
    case 'running': return '#0c2d5e';
    case 'failed': case 'dead': return '#3b1114';
    case 'cancelled': return '#1e2030';
    default: return '#3b2f08';
  }
}

function DagGraph({ wf }: { wf: WorkflowInstance }) {
  const dagNodes = computeLayers(wf);
  if (dagNodes.length === 0) return null;

  const nodePos = new Map<string, { x: number; y: number }>();
  const maxLayer = Math.max(...dagNodes.map((n) => n.layer));

  // Count nodes per layer for centering
  const layerCounts = new Map<number, number>();
  for (const n of dagNodes) {
    layerCounts.set(n.layer, (layerCounts.get(n.layer) ?? 0) + 1);
  }
  const maxCols = Math.max(...layerCounts.values());

  for (const n of dagNodes) {
    const layerWidth = (layerCounts.get(n.layer) ?? 1);
    const totalWidth = layerWidth * NODE_W + (layerWidth - 1) * COL_GAP;
    const maxWidth = maxCols * NODE_W + (maxCols - 1) * COL_GAP;
    const offsetX = (maxWidth - totalWidth) / 2;
    const x = offsetX + n.col * (NODE_W + COL_GAP);
    const y = n.layer * (NODE_H + LAYER_GAP);
    nodePos.set(n.name, { x, y });
  }

  const svgW = maxCols * NODE_W + (maxCols - 1) * COL_GAP + 40;
  const svgH = (maxLayer + 1) * (NODE_H + LAYER_GAP) + 20;

  // Collect edges
  const edges: { from: string; to: string }[] = [];
  for (const task of wf.definition.tasks) {
    for (const dep of task.depends_on ?? []) {
      edges.push({ from: dep, to: task.name });
    }
  }

  return (
    <svg width={svgW + 20} height={svgH} className="dag-svg">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#5a5e72" />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map(({ from, to }) => {
        const p1 = nodePos.get(from);
        const p2 = nodePos.get(to);
        if (!p1 || !p2) return null;
        const x1 = p1.x + NODE_W / 2 + 10;
        const y1 = p1.y + NODE_H;
        const x2 = p2.x + NODE_W / 2 + 10;
        const y2 = p2.y;
        const midY = (y1 + y2) / 2;
        return (
          <path
            key={`${from}-${to}`}
            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            fill="none"
            stroke="#5a5e72"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
        );
      })}

      {/* Nodes */}
      {dagNodes.map((n) => {
        const pos = nodePos.get(n.name)!;
        const x = pos.x + 10;
        const y = pos.y;
        return (
          <g key={n.name}>
            <rect
              x={x}
              y={y}
              width={NODE_W}
              height={NODE_H}
              rx={6}
              fill={statusBg(n.state.status)}
              stroke={statusColor(n.state.status)}
              strokeWidth={1.5}
            />
            <text
              x={x + NODE_W / 2}
              y={y + 20}
              textAnchor="middle"
              fill="#e8eaf0"
              fontSize={12}
              fontWeight={600}
            >
              {n.name}
            </text>
            <text
              x={x + NODE_W / 2}
              y={y + 36}
              textAnchor="middle"
              fill={statusColor(n.state.status)}
              fontSize={10}
            >
              {n.state.status}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data: wf, isLoading, error } = useWorkflow(id!);
  const cancelMut = useCancelWorkflow();
  const retryMut = useRetryWorkflow();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!wf) return <div className="error">Workflow not found</div>;

  const taskEntries = Object.values(wf.tasks ?? {});
  const isActive = wf.status === 'pending' || wf.status === 'running';

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={() => navigate('/workflows')}>Back</button>
        <h2>{wf.workflow_name}</h2>
        <span className={`badge badge-${wf.status}`}>{wf.status}</span>
        {!readOnly && isActive && (
          <button
            className="btn btn-danger"
            onClick={() => cancelMut.mutate(wf.id)}
            disabled={cancelMut.isPending}
          >
            Cancel Workflow
          </button>
        )}
        {!readOnly && wf.status === 'failed' && (
          <button
            className="btn"
            onClick={() => retryMut.mutate(wf.id)}
            disabled={retryMut.isPending}
          >
            Retry Workflow
          </button>
        )}
      </div>

      <div className="detail">
        <dl>
          <dt>ID</dt>
          <dd className="mono">{wf.id}</dd>
          {wf.deadline && (
            <>
              <dt>Deadline</dt>
              <dd>{formatCountdown(wf.deadline)}</dd>
            </>
          )}
          {wf.attempt != null && wf.max_attempts != null && (
            <>
              <dt>Attempt</dt>
              <dd>{wf.attempt} / {wf.max_attempts}</dd>
            </>
          )}
          <dt>Created</dt>
          <dd>{timeAgo(wf.created_at)}</dd>
          <dt>Updated</dt>
          <dd>{timeAgo(wf.updated_at)}</dd>
          {wf.completed_at && (
            <>
              <dt>Completed</dt>
              <dd>{timeAgo(wf.completed_at)}</dd>
            </>
          )}
        </dl>
      </div>

      <h3>Task Graph</h3>
      <div className="dag-container">
        <DagGraph wf={wf} />
      </div>

      <h3>Tasks</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Task Type</th>
            <th>Status</th>
            <th>Job ID</th>
            <th>Dependencies</th>
            <th>Started</th>
            <th>Finished</th>
          </tr>
        </thead>
        <tbody>
          {taskEntries.map((t) => {
            const def = wf.definition.tasks.find((d) => d.name === t.name);
            return (
              <tr key={t.name}>
                <td>{t.name}</td>
                <td>{def?.task_type ?? '-'}</td>
                <td>
                  <span className={`badge badge-${t.status}`}>{t.status}</span>
                </td>
                <td className="mono">
                  {t.job_id ? (
                    <span
                      className="link"
                      onClick={() => navigate(`/jobs/${t.job_id}`)}
                    >
                      {t.job_id.substring(0, 12)}...
                    </span>
                  ) : '-'}
                </td>
                <td>{def?.depends_on?.join(', ') || '-'}</td>
                <td>{t.started_at ? timeAgo(t.started_at) : '-'}</td>
                <td>{t.finished_at ? timeAgo(t.finished_at) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {wf.input != null && (
        <>
          <h3>Input</h3>
          <JsonView data={wf.input} />
        </>
      )}
    </div>
  );
}
