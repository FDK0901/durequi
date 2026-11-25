import type { JobRun } from '../../api';
import { outcomeOf } from '../../util';

/** The last runs of a job, oldest first. Failures are taller. */
export function RunStrip({ runs, count = 20 }: { runs: JobRun[]; count?: number }) {
  const shown = runs.slice(0, count).reverse();
  if (shown.length === 0) return <span className="muted">no runs</span>;
  const failed = shown.filter((r) => outcomeOf(r) === 'failed').length;
  const recovered = shown.filter((r) => outcomeOf(r) === 'recovered').length;
  const label = `Last ${shown.length} runs: ${failed} failed, ${recovered} succeeded after a retry`;
  return (
    <span className="run-strip" role="img" aria-label={label} title={label}>
      {shown.map((r) => <i key={r.id} className={`tone-${outcomeOf(r)}`} />)}
    </span>
  );
}
