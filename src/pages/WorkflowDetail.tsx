import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWorkflow, useCancelWorkflow, useRetryWorkflow, useWorkflowAuditTrail, useWorkflowTaskResult, useSuspendWorkflow, useResumeWorkflow, useWorkflowSignalStats } from '../hooks';
import { useSettings } from '../context/useSettings';
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

interface DagEdge {
  from: string;
  to: string;
  label?: string;        // condition route label
  isConditionRoute: boolean;
  isBackEdge: boolean;   // condition loop back-edge
  isResultFrom: boolean;
}

function computeLayers(wf: WorkflowInstance): DagNode[] {
  const defs = new Map(wf.definition.tasks.map((t) => [t.name, t]));

  // Build condition route targets for back-edge detection.
  const conditionBackEdges = new Set<string>();
  for (const t of wf.definition.tasks) {
    if (t.type === 'condition' && t.condition_routes) {
      for (const target of Object.values(t.condition_routes)) {
        conditionBackEdges.add(`${t.name}->${target}`);
      }
    }
  }

  // Kahn's algorithm to assign layers (skip back-edges from conditions)
  const inDeg = new Map<string, number>();
  const deps = new Map<string, string[]>(); // dep -> dependents
  for (const t of wf.definition.tasks) {
    if (!inDeg.has(t.name)) inDeg.set(t.name, 0);
    for (const d of t.depends_on ?? []) {
      if (conditionBackEdges.has(`${d}->${t.name}`)) continue;
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

  // Assign layers to nodes not reached by Kahn's (in cycle via condition)
  for (const t of wf.definition.tasks) {
    if (!layerMap.has(t.name)) layerMap.set(t.name, 0);
  }

  // Group by layer and assign col positions (sort by priority desc within layer)
  const byLayer = new Map<number, string[]>();
  for (const [name, layer] of layerMap) {
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(name);
  }

  const nodes: DagNode[] = [];
  for (const [layer, names] of byLayer) {
    // Sort by priority (descending), then name (ascending).
    names.sort((a, b) => {
      const pa = defs.get(a)?.priority ?? 0;
      const pb = defs.get(b)?.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return a.localeCompare(b);
    });
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

function computeEdges(wf: WorkflowInstance): DagEdge[] {
  const defs = new Map(wf.definition.tasks.map((t) => [t.name, t]));
  const edges: DagEdge[] = [];

  // Regular dependency edges.
  for (const task of wf.definition.tasks) {
    for (const dep of task.depends_on ?? []) {
      // Check if this is a condition route edge.
      const depDef = defs.get(dep);
      let isCondRoute = false;
      let routeLabel: string | undefined;
      let isBackEdge = false;

      if (depDef?.type === 'condition' && depDef.condition_routes) {
        for (const [routeIdx, target] of Object.entries(depDef.condition_routes)) {
          if (target === task.name) {
            isCondRoute = true;
            routeLabel = `route ${routeIdx}`;
            isBackEdge = true; // condition routes are potential back-edges
            break;
          }
        }
      }

      const isResultFrom = task.result_from === dep;
      edges.push({ from: dep, to: task.name, label: isResultFrom ? 'data' : routeLabel, isConditionRoute: isCondRoute, isBackEdge, isResultFrom });
    }
  }

  // Add condition route edges that aren't already in DependsOn.
  for (const task of wf.definition.tasks) {
    if (task.type !== 'condition' || !task.condition_routes) continue;
    for (const [routeIdx, target] of Object.entries(task.condition_routes)) {
      const exists = edges.some(e => e.from === task.name && e.to === target);
      if (!exists) {
        edges.push({
          from: task.name,
          to: target,
          label: `route ${routeIdx}`,
          isConditionRoute: true,
          isBackEdge: true,
          isResultFrom: false,
        });
      }
    }
  }

  return edges;
}

const NODE_W = 170;
const NODE_H = 54;
const LAYER_GAP = 80;
const COL_GAP = 44;

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return '#4ade80';
    case 'running': return '#60a5fa';
    case 'failed': case 'dead': return '#f87171';
    case 'cancelled': return '#8b8fa3';
    case 'paused': case 'suspended': return '#c084fc';
    case 'continued': return '#22d3ee';
    default: return '#fbbf24';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'completed': return '#0a3622';
    case 'running': return '#0c2d5e';
    case 'failed': case 'dead': return '#3b1114';
    case 'cancelled': return '#1e2030';
    case 'paused': case 'suspended': return '#2d1b4e';
    case 'continued': return '#0c3544';
    default: return '#3b2f08';
  }
}

function typeIcon(type?: string): string {
  switch (type) {
    case 'condition': return '\u25c7'; // diamond
    case 'subflow': return '\u29c9';   // joined squares
    default: return '';
  }
}

function DagGraph({ wf, onNodeClick, selectedTask }: { wf: WorkflowInstance; onNodeClick?: (name: string) => void; selectedTask?: string | null }) {
  const dagNodes = computeLayers(wf);
  const dagEdges = computeEdges(wf);
  if (dagNodes.length === 0) return null;

  const nodePos = new Map<string, { x: number; y: number }>();
  const maxLayer = Math.max(...dagNodes.map((n) => n.layer));

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

  return (
    <svg width={svgW + 20} height={svgH} className="dag-svg">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#5a5e72" />
        </marker>
        <marker id="arrow-cond" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#c084fc" />
        </marker>
        <marker id="arrow-result" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#22d3ee" />
        </marker>
      </defs>

      {/* Edges */}
      {dagEdges.map(({ from, to, label, isConditionRoute, isBackEdge, isResultFrom }) => {
        const p1 = nodePos.get(from);
        const p2 = nodePos.get(to);
        if (!p1 || !p2) return null;

        const x1 = p1.x + NODE_W / 2 + 10;
        const y1 = p1.y + NODE_H;
        const x2 = p2.x + NODE_W / 2 + 10;
        const y2 = p2.y;

        const edgeColor = isResultFrom ? '#22d3ee' : isConditionRoute ? '#c084fc' : '#5a5e72';
        const dashArray = isBackEdge ? '6,3' : undefined;
        const markerEnd = isResultFrom ? 'url(#arrow-result)' : isConditionRoute ? 'url(#arrow-cond)' : 'url(#arrow)';

        // For back-edges (going upward), curve around the side.
        if (y2 <= y1) {
          const sideOffset = 30;
          const pathD = `M ${x1} ${y1} C ${x1 + sideOffset} ${y1 + 40}, ${x2 - sideOffset} ${y2 - 40}, ${x2} ${y2}`;
          return (
            <g key={`${from}-${to}`}>
              <path
                d={pathD}
                fill="none"
                stroke={edgeColor}
                strokeWidth={1.5}
                strokeDasharray={dashArray}
                markerEnd={markerEnd}
                opacity={0.7}
              />
              {label && (
                <text
                  x={(x1 + x2) / 2 + sideOffset}
                  y={(y1 + y2) / 2}
                  fill={edgeColor}
                  fontSize={9}
                  textAnchor="middle"
                  opacity={0.8}
                >
                  {label}
                </text>
              )}
            </g>
          );
        }

        const midY = (y1 + y2) / 2;
        return (
          <g key={`${from}-${to}`}>
            <path
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none"
              stroke={edgeColor}
              strokeWidth={1.5}
              strokeDasharray={dashArray}
              markerEnd={markerEnd}
            />
            {label && (
              <text
                x={(x1 + x2) / 2 + 8}
                y={midY - 4}
                fill={edgeColor}
                fontSize={9}
                textAnchor="start"
                opacity={0.8}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {dagNodes.map((n) => {
        const pos = nodePos.get(n.name)!;
        const x = pos.x + 10;
        const y = pos.y;
        const isCondition = n.def.type === 'condition';
        const isSubflow = n.def.type === 'subflow';
        const hasPriority = (n.def.priority ?? 0) > 0;
        const isSkipped = n.state.skipped;
        const isSelected = selectedTask === n.name;
        const displayStatus = isSkipped ? 'skipped' : n.state.status;
        const nodeStroke = isSkipped ? '#8b8fa3' : statusColor(n.state.status);
        const nodeFill = isSkipped ? '#1e2030' : statusBg(n.state.status);
        const strokeW = isSelected ? 3 : 1.5;

        return (
          <g key={n.name} onClick={() => onNodeClick?.(n.name)} style={{ cursor: 'pointer' }}>
            {/* Node shape */}
            {isCondition ? (
              <polygon
                points={`${x + NODE_W / 2},${y} ${x + NODE_W},${y + NODE_H / 2} ${x + NODE_W / 2},${y + NODE_H} ${x},${y + NODE_H / 2}`}
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={strokeW}
              />
            ) : (
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={isSubflow ? 2 : 6}
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={strokeW}
                strokeDasharray={isSubflow ? '5,3' : undefined}
              />
            )}

            {/* Type icon */}
            {(isCondition || isSubflow) && (
              <text
                x={x + 8}
                y={y + 14}
                fill={nodeStroke}
                fontSize={10}
                opacity={0.7}
              >
                {typeIcon(n.def.type)}
              </text>
            )}

            {/* AllowFailure badge */}
            {n.def.allow_failure && (
              <text
                x={x + 6}
                y={y + 14}
                fill="#fbbf24"
                fontSize={9}
                fontWeight={700}
              >
                AF
              </text>
            )}

            {/* Error indicator */}
            {n.state.error && (
              <>
                <circle cx={x + NODE_W - 6} cy={y + 6} r={7} fill="#3b1114" stroke="#f87171" strokeWidth={1} />
                <text x={x + NODE_W - 6} y={y + 10} textAnchor="middle" fill="#f87171" fontSize={9} fontWeight={700}>!</text>
              </>
            )}

            {/* Priority badge */}
            {hasPriority && !n.state.error && (
              <>
                <circle cx={x + NODE_W - 8} cy={y + 10} r={8} fill="#3b2f08" stroke="#fbbf24" strokeWidth={1} />
                <text x={x + NODE_W - 8} y={y + 14} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight={700}>
                  {n.def.priority}
                </text>
              </>
            )}

            {/* Task name */}
            <text
              x={x + NODE_W / 2}
              y={y + 22}
              textAnchor="middle"
              fill={isSkipped ? '#8b8fa3' : '#e8eaf0'}
              fontSize={12}
              fontWeight={600}
            >
              {n.name}
            </text>

            {/* Status text */}
            <text
              x={x + NODE_W / 2}
              y={y + 38}
              textAnchor="middle"
              fill={isSkipped ? '#8b8fa3' : statusColor(n.state.status)}
              fontSize={10}
            >
              {displayStatus}
              {n.state.condition_route != null && ` \u2192 ${n.state.condition_route}`}
            </text>

            {/* Duration or child workflow indicator */}
            {n.state.started_at && n.state.finished_at && (
              <text
                x={x + NODE_W / 2}
                y={y + NODE_H + 12}
                textAnchor="middle"
                fill="#8b8fa3"
                fontSize={9}
              >
                {formatDurationMs(new Date(n.state.finished_at).getTime() - new Date(n.state.started_at).getTime())}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// --- Execution Timeline ---

function ExecutionTimeline({ wf }: { wf: WorkflowInstance }) {
  const tasks = Object.values(wf.tasks ?? {});
  const withTimes = tasks.filter(t => t.started_at);
  if (withTimes.length === 0) return null;

  const allTimes = withTimes.flatMap(t => {
    const times = [new Date(t.started_at!).getTime()];
    if (t.finished_at) times.push(new Date(t.finished_at).getTime());
    return times;
  });
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes, Date.now());
  const totalSpan = maxTime - minTime || 1;

  const BAR_H = 24;
  const ROW_GAP = 4;
  const LABEL_W = 140;
  const CHART_W = 500;
  const SVG_W = LABEL_W + CHART_W + 20;
  const SVG_H = withTimes.length * (BAR_H + ROW_GAP) + 30;

  // Sort by start time.
  withTimes.sort((a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime());

  return (
    <svg width={SVG_W} height={SVG_H} className="dag-svg" style={{ marginTop: 8 }}>
      {/* Time axis */}
      <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={SVG_H - 20} stroke="#2a2d3d" strokeWidth={1} />
      <text x={LABEL_W} y={SVG_H - 4} fill="#8b8fa3" fontSize={9}>
        {new Date(minTime).toLocaleTimeString()}
      </text>
      <text x={LABEL_W + CHART_W} y={SVG_H - 4} fill="#8b8fa3" fontSize={9} textAnchor="end">
        {new Date(maxTime).toLocaleTimeString()}
      </text>

      {/* Vertical grid lines */}
      {[1, 2, 3, 4, 5].map((i) => {
        const frac = i / 6;
        const gx = LABEL_W + frac * CHART_W;
        const gTime = new Date(minTime + frac * totalSpan);
        return (
          <g key={`grid-${i}`}>
            <line x1={gx} y1={0} x2={gx} y2={SVG_H - 20} stroke="#2a2d3d" strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={gx} y={SVG_H - 4} fill="#5a5e72" fontSize={8} textAnchor="middle">
              {gTime.toLocaleTimeString()}
            </text>
          </g>
        );
      })}

      {withTimes.map((t, i) => {
        const y = i * (BAR_H + ROW_GAP) + 2;
        const startPct = (new Date(t.started_at!).getTime() - minTime) / totalSpan;
        const endPct = t.finished_at
          ? (new Date(t.finished_at).getTime() - minTime) / totalSpan
          : (Date.now() - minTime) / totalSpan;
        const barX = LABEL_W + startPct * CHART_W;
        const barW = Math.max((endPct - startPct) * CHART_W, 2);
        const dur = t.finished_at
          ? formatDurationMs(new Date(t.finished_at).getTime() - new Date(t.started_at!).getTime())
          : 'running';

        return (
          <g key={t.name}>
            <text
              x={LABEL_W - 6}
              y={y + BAR_H / 2 + 4}
              textAnchor="end"
              fill="#e8eaf0"
              fontSize={11}
            >
              {t.name}
            </text>
            <rect
              x={barX}
              y={y}
              width={barW}
              height={BAR_H}
              rx={3}
              fill={statusBg(t.status)}
              stroke={statusColor(t.status)}
              strokeWidth={1}
            >
              <title>{`${t.name}\nStart: ${new Date(t.started_at!).toLocaleTimeString()}\nEnd: ${t.finished_at ? new Date(t.finished_at).toLocaleTimeString() : 'running'}\nDuration: ${dur}`}</title>
            </rect>
            {/* Running indicator: pulsing right edge */}
            {!t.finished_at && t.status === 'running' && (
              <rect
                x={barX + barW - 3}
                y={y}
                width={3}
                height={BAR_H}
                fill={statusColor(t.status)}
                opacity={0.6}
              >
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite" />
              </rect>
            )}
            <text
              x={barX + barW / 2}
              y={y + BAR_H / 2 + 4}
              textAnchor="middle"
              fill="#e8eaf0"
              fontSize={10}
            >
              {t.status}
              {t.started_at && t.finished_at && ` (${formatDurationMs(new Date(t.finished_at).getTime() - new Date(t.started_at).getTime())})`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- Task Detail Sidebar ---

function TaskDetailSidebar({ wf, taskName, onClose }: { wf: WorkflowInstance; taskName: string; onClose: () => void }) {
  const navigate = useNavigate();
  const state = wf.tasks?.[taskName];
  const def = wf.definition.tasks.find((d) => d.name === taskName);
  const [showOutput, setShowOutput] = useState(false);
  const { data: taskResult } = useWorkflowTaskResult(showOutput ? wf.id : '', showOutput ? taskName : '');

  if (!state) return null;

  const duration = state.started_at && state.finished_at
    ? formatDurationMs(new Date(state.finished_at).getTime() - new Date(state.started_at).getTime())
    : null;

  return (
    <div className="task-sidebar">
      <div className="task-sidebar-header">
        <h3 style={{ margin: 0 }}>{taskName}</h3>
        <button className="task-sidebar-close" onClick={onClose}>&times;</button>
      </div>
      <span className={`badge badge-${state.skipped ? 'skipped' : state.status}`}>
        {state.skipped ? 'skipped' : state.status}
      </span>
      <dl>
        {def?.type && (
          <>
            <dt>Type</dt>
            <dd>{def.type}</dd>
          </>
        )}
        <dt>Task Type</dt>
        <dd>{def?.task_type ?? '-'}</dd>
        {(def?.priority ?? 0) > 0 && (
          <>
            <dt>Priority</dt>
            <dd>{def!.priority}</dd>
          </>
        )}
        {state.job_id && (
          <>
            <dt>Job ID</dt>
            <dd>
              <span className="link" onClick={() => navigate(`/jobs/${state.job_id}`)}>
                {state.job_id.substring(0, 16)}...
              </span>
            </dd>
          </>
        )}
        {state.child_workflow_id && (
          <>
            <dt>Child WF</dt>
            <dd>
              <span className="link" onClick={() => navigate(`/workflows/${state.child_workflow_id}`)}>
                {state.child_workflow_id.substring(0, 16)}...
              </span>
            </dd>
          </>
        )}
        {state.started_at && (
          <>
            <dt>Started</dt>
            <dd>{timeAgo(state.started_at)}</dd>
          </>
        )}
        {state.finished_at && (
          <>
            <dt>Finished</dt>
            <dd>{timeAgo(state.finished_at)}</dd>
          </>
        )}
        {duration && (
          <>
            <dt>Duration</dt>
            <dd>{duration}</dd>
          </>
        )}
        {def?.depends_on && def.depends_on.length > 0 && (
          <>
            <dt>Dependencies</dt>
            <dd>{def.depends_on.join(', ')}</dd>
          </>
        )}
        {def?.result_from && (
          <>
            <dt>Result From</dt>
            <dd>{def.result_from}</dd>
          </>
        )}
        {def?.allow_failure && (
          <>
            <dt>Allow Failure</dt>
            <dd>Yes</dd>
          </>
        )}
        {def?.result_reuse && def.result_reuse !== 'always' && (
          <>
            <dt>Result Reuse</dt>
            <dd>{def.result_reuse}</dd>
          </>
        )}
        {state.error && (
          <>
            <dt>Error</dt>
            <dd className="error-text" style={{ whiteSpace: 'pre-wrap' }}>{state.error}</dd>
          </>
        )}
        {state.skip_reason && (
          <>
            <dt>Skip Reason</dt>
            <dd>{state.skip_reason}</dd>
          </>
        )}
        {state.iterations != null && (
          <>
            <dt>Iterations</dt>
            <dd>{state.iterations}</dd>
          </>
        )}
        {state.subflow_tasks && state.subflow_tasks.length > 0 && (
          <>
            <dt>Subflow Tasks</dt>
            <dd>{state.subflow_tasks.join(', ')}</dd>
          </>
        )}
      </dl>
      {!showOutput ? (
        <button className="btn" style={{ marginTop: '1rem' }} onClick={() => setShowOutput(true)}>
          View Output
        </button>
      ) : taskResult ? (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ color: '#c0c4d6', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Output</h4>
          <JsonView data={taskResult.output} />
        </div>
      ) : (
        <p className="muted" style={{ marginTop: '1rem' }}>Loading output...</p>
      )}
    </div>
  );
}

// --- Main component ---

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data: wf, isLoading, error } = useWorkflow(id!);
  const { data: auditTrail } = useWorkflowAuditTrail(id!);
  const { data: signalStats } = useWorkflowSignalStats(id!);
  const cancelMut = useCancelWorkflow();
  const retryMut = useRetryWorkflow();
  const suspendMut = useSuspendWorkflow();
  const resumeMut = useResumeWorkflow();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showDef, setShowDef] = useState(false);

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!wf) return <div className="error">Workflow not found</div>;

  const taskEntries = Object.values(wf.tasks ?? {});
  const isActive = wf.status === 'pending' || wf.status === 'running' || wf.status === 'suspended';
  const hookEntries = wf.hook_states ? Object.entries(wf.hook_states) : [];

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
        {!readOnly && wf.status === 'running' && (
          <button
            className="btn btn-warning"
            onClick={() => suspendMut.mutate(wf.id)}
            disabled={suspendMut.isPending}
          >
            Suspend
          </button>
        )}
        {!readOnly && wf.status === 'suspended' && (
          <button
            className="btn"
            onClick={() => resumeMut.mutate(wf.id)}
            disabled={resumeMut.isPending}
          >
            Resume
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
          {wf.parent_workflow_id && (
            <>
              <dt>Parent Workflow</dt>
              <dd className="mono">
                <span
                  className="link"
                  onClick={() => navigate(`/workflows/${wf.parent_workflow_id}`)}
                >
                  {wf.parent_workflow_id}
                </span>
                {wf.parent_task_name && <> (task: {wf.parent_task_name})</>}
              </dd>
            </>
          )}
          {wf.continued_from && (
            <>
              <dt>Continued From</dt>
              <dd className="mono">
                <span
                  className="link"
                  onClick={() => navigate(`/workflows/${wf.continued_from}`)}
                >
                  {wf.continued_from}
                </span>
              </dd>
            </>
          )}
          {wf.continued_to && (
            <>
              <dt>Continued To</dt>
              <dd className="mono">
                <span
                  className="link"
                  onClick={() => navigate(`/workflows/${wf.continued_to}`)}
                >
                  {wf.continued_to}
                </span>
              </dd>
            </>
          )}
          {wf.attempt != null && wf.max_attempts != null && (
            <>
              <dt>Attempt</dt>
              <dd>{wf.attempt} / {wf.max_attempts}</dd>
            </>
          )}
          {(wf.archived_task_count ?? 0) > 0 && (
            <>
              <dt>Archived Tasks</dt>
              <dd>{wf.archived_task_count} (compacted)</dd>
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

      {signalStats && (
        <div className="detail" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Signal Stats</h3>
          <dl>
            <dt>Pending Signals</dt>
            <dd>{signalStats.pending_count}</dd>
            {signalStats.pending_count > 0 && (
              <>
                <dt>Oldest Unacked</dt>
                <dd>
                  {signalStats.oldest_unacked_age_ms < 1000
                    ? `${signalStats.oldest_unacked_age_ms}ms`
                    : signalStats.oldest_unacked_age_ms < 60000
                      ? `${(signalStats.oldest_unacked_age_ms / 1000).toFixed(1)}s`
                      : `${(signalStats.oldest_unacked_age_ms / 60000).toFixed(1)}m`}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      <h3>Task Graph</h3>
      <div className="dag-container">
        <DagGraph wf={wf} onNodeClick={(name) => setSelectedTask(name)} selectedTask={selectedTask} />
      </div>

      <h3>Execution Timeline</h3>
      <div className="dag-container">
        <ExecutionTimeline wf={wf} />
      </div>

      <h3>Tasks</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Task Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Job ID</th>
            <th>Dependencies</th>
            <th>Child Workflow</th>
            <th>Error</th>
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
                <td>
                  {def?.type === 'condition' && <span className="badge badge-paused">condition</span>}
                  {def?.type === 'subflow' && <span className="badge badge-pending">subflow</span>}
                  {!def?.type && '-'}
                </td>
                <td>{def?.task_type ?? '-'}</td>
                <td>{def?.priority ?? '-'}</td>
                <td>
                  <span className={`badge badge-${t.status}`}>{t.status}</span>
                  {t.condition_route != null && <span style={{ marginLeft: 4, color: '#c084fc', fontSize: 11 }}>route {t.condition_route}</span>}
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
                <td className="mono">
                  {t.child_workflow_id ? (
                    <span
                      className="link"
                      onClick={() => navigate(`/workflows/${t.child_workflow_id}`)}
                    >
                      {t.child_workflow_id.substring(0, 12)}...
                    </span>
                  ) : def?.child_workflow_def ? (
                    <span className="badge badge-pending">child</span>
                  ) : t.subflow_tasks && t.subflow_tasks.length > 0 ? (
                    <span style={{ color: '#c084fc', fontSize: 11 }}>{t.subflow_tasks.length} injected</span>
                  ) : '-'}
                </td>
                <td className="error-cell">{t.error || '-'}</td>
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

      {wf.output != null && (
        <>
          <h3>Output</h3>
          <JsonView data={wf.output} />
        </>
      )}

      <h3>Definition</h3>
      {showDef ? (
        <>
          <button className="collapsible-toggle" onClick={() => setShowDef(false)}>Hide</button>
          <JsonView data={wf.definition} />
        </>
      ) : (
        <button className="collapsible-toggle" onClick={() => setShowDef(true)}>Show Definition</button>
      )}

      {hookEntries.length > 0 && (
        <>
          <h3>Lifecycle Hooks</h3>
          <table>
            <thead>
              <tr>
                <th>Hook</th>
                <th>Status</th>
                <th>Job ID</th>
              </tr>
            </thead>
            <tbody>
              {hookEntries.map(([hookName, hookState]) => (
                <tr key={hookName}>
                  <td>{hookName}</td>
                  <td><span className={`badge badge-${hookState.status}`}>{hookState.status}</span></td>
                  <td className="mono">
                    {hookState.job_id ? (
                      <span className="link" onClick={() => navigate(`/jobs/${hookState.job_id}`)}>
                        {hookState.job_id.substring(0, 12)}...
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {auditTrail && auditTrail.length > 0 && (
        <>
          <h3>Audit Trail</h3>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Task</th>
                <th>Status</th>
                <th>Job ID</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.map((entry) => (
                <tr key={entry.id}>
                  <td>{timeAgo(entry.timestamp)}</td>
                  <td>{entry.task_name}</td>
                  <td><span className={`badge badge-${entry.status}`}>{entry.status}</span></td>
                  <td className="mono">
                    <span
                      className="link"
                      onClick={() => navigate(`/jobs/${entry.job_id}`)}
                    >
                      {entry.job_id.substring(0, 12)}...
                    </span>
                  </td>
                  <td className="error-text">{entry.error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {selectedTask && (
        <TaskDetailSidebar
          wf={wf}
          taskName={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
