import { Link } from 'react-router';
import type { JobRun } from '../api';
import { useActiveRuns, useLockInfo, useRequeueRun } from '../hooks';
import { useSettings } from '../context/useSettings';
import { useNow } from '../context/useNow';
import { describeOperation, formatDateTime, formatMs, formatNs, outcomeOf, startOf, timeAgo } from '../util';
import { CopyId } from './CopyId';
import { Progress } from './Progress';

/** The details of a run, at the side of the page it was picked on. */
export function RunDrawer({ run: picked, onClose }: { run: JobRun; onClose: () => void }) {
  const { readOnly } = useSettings();
  const now = useNow();
  const { data: active } = useActiveRuns();
  const requeue = useRequeueRun();
  // A run that is going is updated as it goes.
  const live = active?.find((r) => r.id === picked.id);
  const run = live ?? picked;
  const ended = outcomeOf(run) !== 'running';
  const { data: lock } = useLockInfo(live ? `run:${run.id}` : '');
  const operation = describeOperation(run);

  return (
    <div className="task-sidebar">
      <div className="task-sidebar-header">
        <h3 style={{ margin: 0 }}>Run</h3>
        <button className="task-sidebar-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>
      <dl>
        <dt>Status</dt>
        <dd>
          {live || ended ? <span className={`badge badge-${run.status}`}>{run.status}</span> : 'no longer running'}
        </dd>
        <dt>Run ID</dt>
        <dd><CopyId id={run.id} length={24} /></dd>
        <dt>Job</dt>
        <dd><Link className="link mono" to={`/jobs/${run.job_id}`}>{run.job_id}</Link></dd>
        <dt>Node</dt>
        <dd>{run.node_id}</dd>
        <dt>Attempt</dt>
        <dd>
          {run.attempt}
          {run.attempt > 0 && run.operation_key && <span className="muted"> ({run.attempt} before it failed or got lost)</span>}
        </dd>
        {run.operation_key && (
          <>
            <dt>Operation</dt>
            <dd>{operation}<div className="muted mono">{run.operation_key}</div></dd>
          </>
        )}
        <dt>Started</dt>
        <dd>{formatDateTime(run.started_at)}</dd>
        {run.finished_at && (
          <>
            <dt>Finished</dt>
            <dd>{formatDateTime(run.finished_at)}</dd>
          </>
        )}
        <dt>Duration</dt>
        <dd>{live ? `${formatMs(now - startOf(run))} so far` : formatNs(run.duration)}</dd>
        {live?.last_heartbeat_at && (
          <>
            <dt>Heartbeat</dt>
            <dd>{timeAgo(live.last_heartbeat_at)}</dd>
          </>
        )}
        {live && lock && (
          <>
            <dt>Lock</dt>
            <dd>{lock.exists ? `${lock.owner}, ${lock.ttl_seconds}s left` : 'not held'}</dd>
          </>
        )}
        {run.error && (
          <>
            <dt>Error</dt>
            <dd className="error-text">{run.error}</dd>
          </>
        )}
      </dl>
      {run.progress != null && <Progress value={run.progress} />}
      {!readOnly && ended && (
        <>
          <button
            className="btn"
            style={{ margin: '1rem 0 0.5rem' }}
            disabled={requeue.isPending}
            onClick={() => { if (confirm('Run the job of this run again?')) requeue.mutate(run.id); }}
          >
            Requeue
          </button>
          <p className="muted">Runs the job again, from its first attempt. Refused while another job holds its unique key.</p>
        </>
      )}
    </div>
  );
}
