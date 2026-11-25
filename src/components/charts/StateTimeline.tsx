import type { AuditEntry } from '../../api';
import { useNow } from '../../context/useNow';
import { formatMs, isTerminal, tickTime } from '../../util';
import { useTip } from './useTip';

const MAX = 60;

/** Which state a job was in for how long, from its audit trail (oldest first). */
export function StateTimeline({ entries }: { entries: AuditEntry[] }) {
  const now = useNow();
  const { tip, over } = useTip();
  const shown = entries.slice(-MAX);
  if (shown.length < 2) return null; // nothing to compare
  const start = new Date(shown[0].timestamp).getTime();
  const last = shown[shown.length - 1];
  // A job that has ended does not stay on the axis for ever.
  const lastAt = new Date(last.timestamp).getTime();
  const end = Math.max(isTerminal(last.status) ? lastAt + Math.max((lastAt - start) * 0.06, 1) : now, start + 1);
  const total = end - start;
  const statuses = [...new Set(shown.map((e) => e.status))];

  return (
    <>
      <div className="states">
        {shown.map((e, i) => {
          const at = new Date(e.timestamp).getTime();
          const until = i + 1 < shown.length ? new Date(shown[i + 1].timestamp).getTime() : end;
          return (
            <i
              key={e.id}
              className={`tone-${e.status}`}
              style={{ left: `${((at - start) / total) * 100}%`, width: `${((until - at) / total) * 100}%` }}
              {...over(() => (
                <>
                  <strong>{e.status}</strong>
                  {i + 1 < shown.length || !isTerminal(e.status) ? ` for ${formatMs(until - at)}` : ''}
                  <div>since {tickTime(e.timestamp)}</div>
                  {e.error && <div className="error-text">{e.error}</div>}
                </>
              ))}
            />
          );
        })}
      </div>
      <div className="states-axis">
        <span>{tickTime(start)}</span>
        <span>{isTerminal(last.status) ? tickTime(last.timestamp) : 'now'}</span>
      </div>
      <div className="chart-legend">
        {statuses.map((s) => <span key={s}><i className={`swatch tone-${s}`} />{s}</span>)}
        {entries.length > MAX && <span>Last {MAX} of {entries.length} changes</span>}
      </div>
      {tip}
    </>
  );
}
