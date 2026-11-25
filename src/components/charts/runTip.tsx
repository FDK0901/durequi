import type { JobRun } from '../../api';
import { OUTCOME_LABEL, describeOperation, formatDateTime, formatMs, formatNs, outcomeOf, startOf } from '../../util';

/** What a run mark tells when it is pointed at. */
export function runTip(run: JobRun, title?: string) {
  const outcome = outcomeOf(run);
  const operation = describeOperation(run);
  return (
    <>
      {title && <div>{title}</div>}
      <strong>
        {OUTCOME_LABEL[outcome]}
        {outcome === 'running' ? ` for ${formatMs(Date.now() - startOf(run))}` : ` in ${formatNs(run.duration)}`}
      </strong>
      <div>{formatDateTime(run.started_at)} on {run.node_id}</div>
      {run.attempt > 0 && run.operation_key && (
        <div>
          Attempt {run.attempt + 1}, after {run.attempt} that failed or got lost
        </div>
      )}
      {operation && <div>{operation}</div>}
      {run.error && <div className="error-text">{run.error}</div>}
    </>
  );
}
