import { useParams, useNavigate } from 'react-router';
import { useJob, useCancelJob, useRetryJob, useJobAuditTrail } from '../hooks';
import { useSettings } from '../context/useSettings';
import { PriorityBadge } from '../components/PriorityBadge';
import { JsonView } from '../components/JsonView';
import { timeAgo } from '../util';

function isTerminal(status: string): boolean {
  return ['completed', 'dead', 'cancelled'].includes(status);
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data: job, isLoading, error } = useJob(id!);
  const { data: auditTrail } = useJobAuditTrail(id!);
  const cancelMut = useCancelJob();
  const retryMut = useRetryJob();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!job) return <div className="error">Job not found</div>;

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={() => navigate('/jobs')}>Back</button>
        <h2>Job Detail</h2>
        {!readOnly && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {!isTerminal(job.status) && (
              <button
                className="btn btn-danger"
                onClick={() => cancelMut.mutate(job.id)}
                disabled={cancelMut.isPending}
              >
                Cancel
              </button>
            )}
            {(job.status === 'failed' || job.status === 'dead') && (
              <button
                className="btn"
                onClick={() => retryMut.mutate(job.id)}
                disabled={retryMut.isPending}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      <div className="detail">
        <dl>
          <dt>ID</dt>
          <dd className="mono">{job.id}</dd>
          <dt>TaskType</dt>
          <dd>{job.task_type}</dd>
          <dt>Status</dt>
          <dd><span className={`badge badge-${job.status}`}>{job.status}</span></dd>
          <dt>Priority</dt>
          <dd><PriorityBadge priority={job.priority} /></dd>
          <dt>Schedule</dt>
          <dd>{job.schedule.type}</dd>
          <dt>Attempt</dt>
          <dd>{job.attempt}</dd>
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
              <dd className="mono">{job.unique_key}</dd>
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
          <dt>Created</dt>
          <dd>{new Date(job.created_at).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(job.updated_at).toLocaleString()}</dd>
        </dl>

        {job.retry_policy && (
          <>
            <h3>Retry Policy</h3>
            <dl>
              <dt>Max Attempts</dt>
              <dd>{job.retry_policy.max_attempts}</dd>
              <dt>Multiplier</dt>
              <dd>{job.retry_policy.multiplier}</dd>
              {job.retry_policy.non_retryable_errors && job.retry_policy.non_retryable_errors.length > 0 && (
                <>
                  <dt>Non-Retryable Errors</dt>
                  <dd>{job.retry_policy.non_retryable_errors.join(', ')}</dd>
                </>
              )}
            </dl>
          </>
        )}

        {job.payload != null && (
          <>
            <h3>Payload</h3>
            <JsonView data={job.payload} />
          </>
        )}

        {auditTrail && auditTrail.length > 0 && (
          <>
            <h3>Audit Trail</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((entry) => (
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
      </div>
    </div>
  );
}
