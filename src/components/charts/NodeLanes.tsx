import type { JobRun } from '../../api';
import { useNow } from '../../context/useNow';
import { endOf, outcomeOf, startOf, tickTime } from '../../util';
import { OutcomeLegend } from './Legend';
import { RunMarks } from './RunMarks';
import { useTip } from './useTip';

const LANE_H = 11;
const MAX_LANES = 14;

/** Runs by node over time; runs that overlap are stacked. */
export function NodeLanes({ runs, onRun }: { runs: JobRun[]; onRun: (run: JobRun) => void }) {
  const now = useNow();
  const { tip, over } = useTip();
  if (runs.length === 0) return null;

  // A run that has been going for long must not squeeze all others: the axis starts at
  // the earliest finished one.
  const finished = runs.filter((r) => outcomeOf(r) !== 'running');
  const from = Math.min(...(finished.length ? finished : runs).map(startOf));
  const to = Math.max(from + 1000, ...runs.map((r) => endOf(r, now)));
  const nodes = [...new Set(runs.map((r) => r.node_id))].sort();

  return (
    <div className="lanes">
      {nodes.map((node) => {
        const own = runs.filter((r) => r.node_id === node);
        const stacked = stack(own, now, (to - from) * 0.004);
        const shown = stacked.filter((s) => s.lane < MAX_LANES);
        const lanes = Math.max(...shown.map((s) => s.lane)) + 1;
        return (
          <div key={node} className="lane-row">
            <div className="lane-name">
              {node}
              <small>{own.length} runs{shown.length < own.length && `, ${own.length - shown.length} not shown`}</small>
            </div>
            <div className="lane-plot" style={{ height: Math.max(lanes * LANE_H + 10, 44) }}>
              <RunMarks
                runs={shown.map((s) => ({ run: s.run, top: s.lane * LANE_H + 6 }))}
                from={from}
                to={to}
                now={now}
                onRun={onRun}
                over={over}
              />
            </div>
          </div>
        );
      })}
      <div className="lane-axis">
        <span>{tickTime(from)}</span>
        <span>{tickTime((from + to) / 2)}</span>
        <span>{now - to < 2000 ? 'now' : tickTime(to)}</span>
      </div>
      <OutcomeLegend />
      {tip}
    </div>
  );
}

/** Puts each run on the first lane that is free when it starts. */
function stack(runs: JobRun[], now: number, gap: number): { run: JobRun; lane: number }[] {
  const freeFrom: number[] = [];
  return [...runs].sort((a, b) => startOf(a) - startOf(b)).map((run) => {
    let lane = freeFrom.findIndex((t) => t <= startOf(run));
    if (lane < 0) lane = freeFrom.length;
    freeFrom[lane] = endOf(run, now) + gap;
    return { run, lane };
  });
}
