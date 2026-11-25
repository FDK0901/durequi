import { useQueues, usePauseQueue, useResumeQueue } from '../hooks';
import { useSettings } from '../context/useSettings';

export default function Queues() {
  const { data: queues, isLoading, error } = useQueues();
  const { readOnly } = useSettings();
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!queues || queues.length === 0) return <div className="page"><h2>Queues</h2><p>No queues configured.</p></div>;

  const totalWeight = queues.reduce((n, q) => n + q.weight, 0) || 1;

  return (
    <div className="page">
      <h2>Queue Management</h2>
      <p className="hint">
        Workers look at the queues in this order; the weight does not change it. Delayed are retries, jobs whose
        concurrency key is taken, and jobs of a handler that is at its limit.
      </p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Weight</th>
            <th>Fetch Batch</th>
            <th>Rate Limit</th>
            <th>Waiting</th>
            <th>In Flight</th>
            <th>Delayed</th>
            <th>Status</th>
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {queues.map((q) => (
            <tr key={q.name}>
              <td><strong>{q.name}</strong></td>
              <td>
                <div className="progress-inline">
                  <div className="progress-bar-sm">
                    <div className="progress-fill-sm" style={{ width: `${(q.weight / totalWeight) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                  <span>{q.weight}</span>
                </div>
              </td>
              <td>{q.fetch_batch}</td>
              <td>{q.rate_limit ? `${q.rate_limit}/s (burst: ${q.rate_burst ?? q.rate_limit})` : '-'}</td>
              <td>{q.waiting?.toLocaleString() ?? '-'}</td>
              <td>{q.in_flight?.toLocaleString() ?? '-'}</td>
              <td>{q.delayed?.toLocaleString() ?? '-'}</td>
              <td>
                <span className={`badge ${q.paused ? 'badge-cancelled' : 'badge-running'}`}>
                  {q.paused ? 'Paused' : 'Active'}
                </span>
              </td>
              {!readOnly && (
                <td>
                  {q.paused ? (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => resumeQueue.mutate(q.name)}
                      disabled={resumeQueue.isPending}
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => pauseQueue.mutate(q.name)}
                      disabled={pauseQueue.isPending}
                    >
                      Pause
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
