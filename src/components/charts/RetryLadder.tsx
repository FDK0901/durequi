import type { Job } from '../../api';
import { formatMs, isRecurring, isTerminal, retryDelays, retryPolicyOf } from '../../util';

const MAX_STEPS = 8;

/** The attempts an execution has, how long it waits in between, and what comes after. */
export function RetryLadder({ job, active }: { job: Job; active: boolean }) {
  const { policy, limit } = retryPolicyOf(job);
  const steps = Math.min(limit, MAX_STEPS);
  const delays = retryDelays(policy, steps);
  // job.attempt counts the attempts that are over, except after a success.
  const used = job.status === 'retrying' || job.status === 'dead' || job.status === 'paused' ? Math.min(job.attempt, steps) : 0;
  const current = !isTerminal(job.status) && (active || job.status === 'retrying' || job.status === 'pending') ? used : -1;
  const keep = isRecurring(job.schedule) && job.schedule.keep_on_failure;

  return (
    <div className="ladder">
      {Array.from({ length: steps }, (_, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="ladder-wait">{formatMs(delays[i - 1])}</span>}
          <span
            className={`ladder-step${i < used ? ' used' : ''}${i === current ? ' now' : ''}`}
            title={i < used ? `Attempt ${i + 1} failed` : i === current ? `Attempt ${i + 1} is next or going` : `Attempt ${i + 1}`}
          >
            {i + 1}
          </span>
        </span>
      ))}
      {limit > steps && <span className="ladder-end">… {limit} in all</span>}
      <span className="ladder-end">
        {keep ? 'then to the DLQ, and on with the next firing' : isRecurring(job.schedule) ? 'then dead, and the schedule ends' : 'then dead'}
      </span>
    </div>
  );
}
