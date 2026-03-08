import { useQueues, usePauseQueue, useResumeQueue } from '../hooks';
import { useSettings } from '../context/SettingsContext';

export default function Queues() {
  const { data: queues, isLoading, error } = useQueues();
  const { readOnly } = useSettings();
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!queues || queues.length === 0) return <div className="page"><h2>Queues</h2><p>No queues configured.</p></div>;

  return (
    <div className="page">
      <h2>Queue Management</h2>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Weight</th>
            <th>Fetch Batch</th>
            <th>Rate Limit</th>
            <th>Pending</th>
            <th>Status</th>
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {queues.map((q) => (
            <tr key={q.name}>
              <td><strong>{q.name}</strong></td>
              <td>{q.weight}</td>
              <td>{q.fetch_batch}</td>
              <td>{q.rate_limit ? `${q.rate_limit}/s (burst: ${q.rate_burst ?? q.rate_limit})` : '-'}</td>
              <td>{q.size}</td>
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
