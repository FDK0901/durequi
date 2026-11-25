import type { JobRun } from '../../api';
import { endOf, formatDateTime, outcomeOf, startOf } from '../../util';
import { runTip } from './runTip';
import type { useTip } from './useTip';

interface RunMarksProps {
  runs: { run: JobRun; top?: number }[]; // top in px; centered if left out
  from: number;
  to: number;
  now: number;
  name?: (run: JobRun) => string;
  onRun: (run: JobRun) => void;
  over: ReturnType<typeof useTip>['over'];
}

/** Runs on a lane of time, to be placed in an element that is positioned. */
export function RunMarks({ runs, from, to, now, name, onRun, over }: RunMarksProps) {
  const x = (t: number) => (Math.max(0, t - from) / (to - from)) * 100;
  return runs.map(({ run, top }) => {
    const outcome = outcomeOf(run);
    const left = x(startOf(run));
    return (
      <button
        key={run.id}
        type="button"
        tabIndex={-1} // the tables have the same runs for the keyboard
        className={`run-mark tone-${outcome}${top == null ? '' : ' stacked'}`}
        aria-label={`${outcome}, ${formatDateTime(run.started_at)}`}
        style={{ left: `${left}%`, width: `max(4px, ${x(endOf(run, now)) - left}%)`, top }}
        onClick={() => onRun(run)}
        {...over(() => runTip(run, name?.(run)))}
      />
    );
  });
}
