import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useJob, useCancelJob, useRetryJob, useResumeJob, useDeleteJob, useUpdateJobPayload, useJobAuditTrail, useJobProgress, useJobRuns, useJobEvents, useActiveRuns, useCheckUniqueKey } from '../hooks';
import { useSettings } from '../context/useSettings';
import { EventTable } from '../components/EventTable';
import { PriorityBadge } from '../components/PriorityBadge';
import { JsonView } from '../components/JsonView';
import { Progress } from '../components/Progress';
import { RunDrawer } from '../components/RunDrawer';
import { RetryLadder } from '../components/charts/RetryLadder';
import { RunDurations } from '../components/charts/RunDurations';
import { StateTimeline } from '../components/charts/StateTimeline';
import { describeOverlap, describeSchedule, formatNs, isRecurring, isRetryable, isTerminal, mergeRuns, outcomeOf, retryPolicyOf, timeAgo, isBlocking } from '../util';
import type { Job, JobRun } from '../api';
import { StaleNote } from '../components/Freshness';

const AUDIT_ROWS = 20;

/** Who holds the unique key of a job, which decides whether it can be retried. */
function UniqueKey({ job }: { job: Job }) {
  const { data: key } = useCheckUniqueKey(job.unique_key!);
  return (
    <>
      <span className="mono">{job.unique_key}</span>
      {key && (
        <span className="sub">
          {!key.exists ? (
            isRetryable(job.status) ? 'Free. A retry takes it back, if no other job has it by then.' : 'Free: another job can be enqueued under it.'
          ) : key.job_id === job.id ? (
            'Held by this job.'
          ) : (
            <>
              Held by <Link className="link" to={`/jobs/${key.job_id}`}>another job</Link>
              {isRetryable(job.status) && ', so that a retry of this one is refused'}.
            </>
          )}
        </span>
      )}
    </>
  );
}

/** The events of a job, once they are asked for: the API has to look through all of them. */
function JobEvents({ id }: { id: string }) {
  const [shown, setShown] = useState(false);
  const { data: events, error, isFetching, refetch } = useJobEvents(id, shown);
  return (
    <>
      <h3>Events</h3>
      {error && <p className="error-text">{error.message}</p>}
      {events && events.length === 0 && <p className="muted">None that the cluster still has.</p>}
      {events && events.length > 0 && <EventTable events={events} subject={false} />}
      <button
        className="btn btn-sm"
        style={{ marginTop: '0.5rem' }}
        onClick={() => (shown ? refetch() : setShown(true))}
        disabled={isFetching}
      >
        {shown ? 'Refresh Events' : 'Show Events'}
      </button>
    </>
  );
}

function Payload({ job }: { job: Job }) {
  const { readOnly } = useSettings();
  const update = useUpdateJobPayload();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState('');

  function save() {
    try {
      update.mutate({ id: job.id, payload: JSON.parse(draft!) }, { onSuccess: () => setDraft(null) });
      setInvalid('');
    } catch (e) {
      setInvalid((e as Error).message);
    }
  }

  return (
    <>
      <h3>Payload</h3>
      {draft == null ? (
        <>
          <JsonView data={job.payload} />
          {!readOnly && !isTerminal(job.status) && (
            <button className="btn btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setDraft(JSON.stringify(job.payload, null, 2))}>
              Edit Payload
            </button>
          )}
        </>
      ) : (
        <>
          <textarea rows={Math.min(20, draft.split('\n').length + 1)} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Payload" />
          {invalid && <p className="error-text">Not valid JSON: {invalid}</p>}
          <p className="hint">Runs from now on get the new payload, not one that has been dispatched already.</p>
          <button className="btn btn-sm btn-primary" onClick={save} disabled={update.isPending}>Save Payload</button>{' '}
          <button className="btn btn-sm" onClick={() => { setDraft(null); setInvalid(''); }}>Discard</button>
        </>
      )}
    </>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data: job, isLoading, error, dataUpdatedAt } = useJob(id!);
  const { data: auditTrail } = useJobAuditTrail(id!);
  const { data: progress } = useJobProgress(id!);
  const { data: runs } = useJobRuns(id!);
  const { data: activeRuns } = useActiveRuns();
  const cancelMut = useCancelJob();
  const retryMut = useRetryJob();
  const resumeMut = useResumeJob();
  const deleteMut = useDeleteJob();
  const [picked, setPicked] = useState<JobRun | null>(null);

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isBlocking(error, job)) return <div className="error">Error: {error.message}</div>;
  if (!job) return <div className="error">Job not found</div>;

  const recurring = isRecurring(job.schedule);
  const { policy, own, limit } = retryPolicyOf(job);
  const allRuns = mergeRuns(activeRuns?.filter((r) => r.job_id === job.id) ?? [], runs ?? []);
  const finished = allRuns.filter((r) => outcomeOf(r) !== 'running');
  const running = allRuns.length - finished.length;

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={() => navigate('/jobs')}>Back</button>
        <h2>Job Detail</h2>
        {!readOnly && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {job.status === 'paused' && (
              <button
                className="btn btn-primary"
                title={recurring ? 'Runs what it was paused on, and goes on with the schedule' : 'Runs what it was paused on'}
                onClick={() => resumeMut.mutate(job.id)}
                disabled={resumeMut.isPending}
              >
                Resume
              </button>
            )}
            {!isTerminal(job.status) && (
              <button
                className="btn btn-danger"
                onClick={() => cancelMut.mutate(job.id)}
                disabled={cancelMut.isPending}
              >
                Cancel
              </button>
            )}
            {isRetryable(job.status) && (
              <button
                className="btn"
                onClick={() => retryMut.mutate(job.id)}
                disabled={retryMut.isPending}
              >
                Retry
              </button>
            )}
            {isTerminal(job.status) && (
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirm('Delete this job?')) deleteMut.mutate(job.id, { onSuccess: () => navigate('/jobs') });
                }}
                disabled={deleteMut.isPending}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      <StaleNote error={error} since={dataUpdatedAt} />

      <div className="detail">
        <dl>
          <dt>ID</dt>
          <dd className="mono">{job.id}</dd>
          <dt>TaskType</dt>
          <dd>{job.task_type}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`badge badge-${job.status}`}>{job.status}</span>
            {running > 0 && <> {running} running</>}
          </dd>
          <dt>Priority</dt>
          <dd><PriorityBadge priority={job.priority} /></dd>
          <dt>Schedule</dt>
          <dd>
            {describeSchedule(job.schedule)}
            {job.schedule.timezone && ` (${job.schedule.timezone})`}
            {recurring && (
              <span className="sub">
                {describeOverlap(job.schedule)}
                {job.schedule.catchup_window && `, missed firings are made up for within ${job.schedule.catchup_window}`}
                {job.schedule.jitter && `, jitter of up to ${job.schedule.jitter}`}
              </span>
            )}
          </dd>
          {(job.schedule.starts_at || job.schedule.ends_at) && (
            <>
              <dt>Period</dt>
              <dd>
                {job.schedule.starts_at && `from ${new Date(job.schedule.starts_at).toLocaleString()} `}
                {job.schedule.ends_at && `until ${new Date(job.schedule.ends_at).toLocaleString()}`}
              </dd>
            </>
          )}
          <dt>Attempt</dt>
          <dd>
            {job.attempt} of {limit}
            {recurring && <span className="sub">of the current firing</span>}
          </dd>
          <dt>Runs</dt>
          <dd>
            {job.run_count ?? '-'}
            {(job.consecutive_errors ?? 0) > 0 && <span className="sub">{job.consecutive_errors} failed in a row</span>}
          </dd>
          {job.paused_at && job.status === 'paused' && (
            <>
              <dt>Paused</dt>
              <dd>
                {timeAgo(job.paused_at)}
                <span className="sub">{job.resume_at ? `resumes at ${new Date(job.resume_at).toLocaleString()}, or when you resume it` : 'until you resume it'}</span>
              </dd>
            </>
          )}
          {job.last_error && (
            <>
              <dt>Last Error</dt>
              <dd className="error-text">{job.last_error}</dd>
            </>
          )}
          {job.next_run_at && (
            <>
              <dt>Next Run</dt>
              <dd>{new Date(job.next_run_at).toLocaleString()}</dd>
            </>
          )}
          {job.last_run_at && (
            <>
              <dt>Last Run</dt>
              <dd>{new Date(job.last_run_at).toLocaleString()}</dd>
            </>
          )}
          {job.completed_at && (
            <>
              <dt>Completed At</dt>
              <dd>{new Date(job.completed_at).toLocaleString()}</dd>
            </>
          )}
          {job.tags && job.tags.length > 0 && (
            <>
              <dt>Tags</dt>
              <dd>{job.tags.join(', ')}</dd>
            </>
          )}
          {job.unique_key && (
            <>
              <dt>Unique Key</dt>
              <dd><UniqueKey job={job} /></dd>
            </>
          )}
          {job.workflow_id && (
            <>
              <dt>Workflow</dt>
              <dd className="mono">
                <a href={`/workflows/${job.workflow_id}`} onClick={(e) => { e.preventDefault(); navigate(`/workflows/${job.workflow_id}`); }}>
                  {job.workflow_id}
                </a>
                {job.workflow_task && <> / {job.workflow_task}</>}
              </dd>
            </>
          )}
          {job.batch_id && (
            <>
              <dt>Batch</dt>
              <dd className="mono">
                <Link className="link" to={`/batches/${job.batch_id}`}>{job.batch_id}</Link>
                {job.batch_item && <> / {job.batch_item}</>}
              </dd>
            </>
          )}
          {job.headers && Object.keys(job.headers).length > 0 && (
            <>
              <dt>Headers</dt>
              <dd className="mono">{Object.entries(job.headers).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</dd>
            </>
          )}
          {job.heartbeat_timeout && (
            <>
              <dt>Heartbeat Timeout</dt>
              <dd>{job.heartbeat_timeout}</dd>
            </>
          )}
          {job.schedule_to_start_timeout && (
            <>
              <dt>Start Timeout</dt>
              <dd>{job.schedule_to_start_timeout}</dd>
            </>
          )}
          {job.concurrency_keys && job.concurrency_keys.length > 0 && (
            <>
              <dt>Concurrency Keys</dt>
              <dd>
                {job.concurrency_keys.map((ck) => (
                  <span key={ck.key} className="badge badge-scheduled" style={{ marginRight: 4 }}>
                    {ck.key} (max: {ck.max_concurrency})
                  </span>
                ))}
              </dd>
            </>
          )}
          <dt>Created</dt>
          <dd>{new Date(job.created_at).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(job.updated_at).toLocaleString()}</dd>
        </dl>

        {progress?.map((p) => p.progress != null && (
          <div key={p.run_id}>
            <h3>Progress</h3>
            <Progress value={p.progress} />
          </div>
        ))}

        {allRuns.length > 0 && (
          <>
            <h3>Runs</h3>
            {finished.length > 1 && (
              <div className="chart-section">
                <RunDurations runs={finished} onRun={setPicked} />
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Node</th>
                  <th>Status</th>
                  <th>Attempt</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {allRuns.slice(0, 15).map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setPicked(r)}>
                    <td className="mono">{r.id.substring(0, 12)}...</td>
                    <td>{r.node_id}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td>{r.attempt}</td>
                    <td>{formatNs(r.duration)}</td>
                    <td>{timeAgo(r.started_at)}</td>
                    <td className="error-cell">{r.error ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3>Retry Policy</h3>
        <RetryLadder job={job} active={running > 0} />
        {!own && <p className="hint">The job has no policy of its own. This is the default; its handler may have another one.</p>}
        {own && (
          <dl>
            <dt>Max Attempts</dt>
            <dd>{policy.max_attempts}{job.dlq_after != null && ` (DLQ after ${job.dlq_after})`}</dd>
            <dt>Multiplier</dt>
            <dd>{policy.multiplier}</dd>
            {(policy.pause_after_err_count ?? 0) > 0 && (
              <>
                <dt>Pause</dt>
                <dd>
                  after {policy.pause_after_err_count} errors in a row
                  {policy.pause_retry_delay ? `, for ${formatNs(policy.pause_retry_delay)}` : ''}
                </dd>
              </>
            )}
            {policy.non_retryable_errors && policy.non_retryable_errors.length > 0 && (
              <>
                <dt>Non-Retryable Errors</dt>
                <dd>{policy.non_retryable_errors.join(', ')}</dd>
              </>
            )}
          </dl>
        )}

        {job.payload != null && <Payload key={job.id} job={job} />}

        {auditTrail && auditTrail.length > 0 && (
          <>
            <h3>Audit Trail</h3>
            <StateTimeline entries={auditTrail} />
            {auditTrail.length > AUDIT_ROWS && <p className="hint">The last {AUDIT_ROWS} of {auditTrail.length} entries. The Audit page has all of them.</p>}
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {[...auditTrail].reverse().slice(0, AUDIT_ROWS).map((entry) => (
                  <tr key={entry.id}>
                    <td>{timeAgo(entry.timestamp)}</td>
                    <td><span className={`badge badge-${entry.status}`}>{entry.status}</span></td>
                    <td className="error-text">{entry.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <JobEvents key={`events-${job.id}`} id={job.id} />
      </div>
      {picked && <RunDrawer run={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}
