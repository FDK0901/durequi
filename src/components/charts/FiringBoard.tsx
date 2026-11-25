import { Link } from 'react-router';
import type { Job, JobRun, ScheduleEntry } from '../../api';
import { useNow } from '../../context/useNow';
import { LATE_MS, describeOverlap, describeSchedule, endOf, formatDateTime, formatDue, outcomeOf, parseGoDuration, shortId, startOf } from '../../util';
import { OutcomeLegend } from './Legend';
import { RunMarks } from './RunMarks';
import { tickLabel, timeTicks } from './scale';
import { useTip } from './useTip';

export interface BoardRow {
  entry: ScheduleEntry;
  job?: Job;
  runs: JobRun[]; // newest first
}

interface FiringBoardProps {
  rows: BoardRow[];
  span: number; // ms
  runLimit: number; // how many finished runs were asked for
  onRun: (run: JobRun) => void;
}

const PAST = 0.62; // share of the time shown that lies behind
const MAX_TICKS = 20; // of firings to come, before they merge into a band

/** One lane per schedule: what has run lies left of now, what is to come on the right. */
export function FiringBoard({ rows, span, runLimit, onRun }: FiringBoardProps) {
  const now = useNow();
  const { tip, over } = useTip();
  const from = now - span * PAST;
  const to = now + span * (1 - PAST);
  const x = (t: number) => `${((t - from) / span) * 100}%`;
  const ticks = timeTicks(from, to, 7);

  return (
    <div className="board">
      <div className="board-axis">
        <span />
        <div className="ticks">
          {ticks.map((t) => Math.abs(t - now) > span * 0.05 && (
            <span key={t} style={{ left: x(t) }}>{tickLabel(t, span)}</span>
          ))}
          <span className="now" style={{ left: x(now) }}>now</span>
        </div>
        <span />
      </div>

      {rows.map(({ entry, job, runs }) => {
        const name = job?.task_type ?? shortId(entry.job_id);
        const next = new Date(entry.next_run_at).getTime();
        const running = runs.filter((r) => outcomeOf(r) === 'running').length;
        const oldest = runs.length >= runLimit ? startOf(runs[runs.length - 1]) : 0;
        const coming = firingsAhead(entry, next, to);
        const shown = runs.filter((r) => endOf(r, now) >= from);

        return (
          <div key={entry.job_id} className="board-row">
            <div className="board-label">
              <Link className="link" to={`/jobs/${entry.job_id}`}>{name}</Link>
              <span className="sub" title={job?.unique_key ?? entry.job_id}>
                {job?.unique_key ?? <span className="mono">{shortId(entry.job_id, 16)}</span>}
              </span>
              <span className="sub" title={describeOverlap(entry.schedule)}>{describeSchedule(entry.schedule)}</span>
            </div>

            <div className="board-lane">
              {ticks.map((t) => <i key={t} className="tick" style={{ left: x(t) }} />)}
              {oldest > from && (
                <div className="unloaded" style={{ width: x(oldest) }} {...over(() => `Older than the last ${runLimit} runs, which are the ones loaded`)} />
              )}
              <RunMarks runs={shown.map((run) => ({ run }))} from={from} to={to} now={now} name={() => name} onRun={onRun} over={over} />
              {coming.band ? (
                <div
                  className="fire-band"
                  style={{ left: x(Math.max(next, now)) }}
                  {...over(() => <><strong>{describeSchedule(entry.schedule)}</strong><div>Next: {formatDateTime(next)}</div></>)}
                />
              ) : (
                coming.times.map((t) => (
                  <span
                    key={t}
                    className={`fire-next${t < now - LATE_MS ? ' late' : ''}`}
                    style={{ left: x(t) }}
                    {...over(() => <><strong>{formatDue(t - now)}</strong><div>{formatDateTime(t)}</div></>)}
                  />
                ))
              )}
              <i className="now-line" style={{ left: x(now) }} />
            </div>

            <div className="board-side">
              <strong>{formatDue(next - now)}</strong>
              {running > 0 ? `${running} running` : job && job.status !== 'scheduled' ? job.status : ''}
            </div>
          </div>
        );
      })}

      <OutcomeLegend>
        <span><i className="swatch swatch-due" />Due</span>
      </OutcomeLegend>
      {tip}
    </div>
  );
}

/**
 * The firings from the next one on. Only an interval tells the ones after it; for other
 * schedules the server knows, and gives the next one only.
 */
function firingsAhead({ schedule }: ScheduleEntry, next: number, until: number): { times: number[]; band: boolean } {
  const end = schedule.ends_at ? Math.min(until, new Date(schedule.ends_at).getTime()) : until;
  if (next > end) return { times: [], band: false };
  const step = schedule.type === 'DURATION' ? parseGoDuration(schedule.interval) : 0;
  if (!step) return { times: [next], band: false };
  const count = Math.floor((end - next) / step) + 1;
  if (count > MAX_TICKS) return { times: [], band: true };
  return { times: Array.from({ length: count }, (_, i) => next + i * step), band: false };
}
