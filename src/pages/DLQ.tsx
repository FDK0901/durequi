import { useState } from 'react';
import { Link } from 'react-router';
import { useDLQ } from '../hooks';
import { JsonView } from '../components/JsonView';
import { Pagination } from '../components/Pagination';
import { isBlocking } from '../util';
import { StaleNote } from '../components/Freshness';

const PAGE_SIZE = 50;

export default function DLQ() {
  const [offset, setOffset] = useState(0);
  const [error_, setError] = useState('');
  const { data, isLoading, error, dataUpdatedAt } = useDLQ({
    limit: PAGE_SIZE,
    offset,
  });

  const messages = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isBlocking(error, data)) return <div className="error">Error: {error.message}</div>;

  const reasonOf = (m: (typeof messages)[number]) => m.metadata?.error ?? 'unknown error';
  const reasons = new Map<string, number>();
  for (const m of messages) reasons.set(reasonOf(m), (reasons.get(reasonOf(m)) ?? 0) + 1);
  const ranked = [...reasons].sort((a, b) => b[1] - a[1]);
  const shown = error_ ? messages.filter((m) => reasonOf(m) === error_) : messages;

  return (
    <div className="page">
      <h2>Dead Letter Queue</h2>
      <StaleNote error={error} since={dataUpdatedAt} />
      <p className="hint">
        Executions that were given up. The job of one may be dead, or have gone on with its next firing (keep on failure).
      </p>

      {messages.length === 0 && (
        <div className="empty-state">DLQ is empty</div>
      )}

      {ranked.length > 1 && (
        <div className="chart-section">
          <div className="chart-header">
            <h3>Errors on this page</h3>
            {error_ && <button className="btn btn-sm" onClick={() => setError('')}>Show all</button>}
          </div>
          <table>
            <tbody>
              {ranked.slice(0, 8).map(([reason, n]) => (
                <tr key={reason} className="clickable" onClick={() => setError(reason === error_ ? '' : reason)}>
                  <td style={{ width: '55%', fontWeight: reason === error_ ? 600 : undefined }}>{reason}</td>
                  <td>{n}</td>
                  <td style={{ width: '35%', verticalAlign: 'middle' }}>
                    <div className="status-bar tone-dead" style={{ width: `${(n / ranked[0][1]) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Task Type</th>
              <th>Attempts</th>
              <th>Error</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.run_id}>
                <td className="mono"><Link className="link" to={`/jobs/${m.job_id}`}>{m.job_id.substring(0, 12)}...</Link></td>
                <td>{m.task_type}</td>
                <td>{m.attempt}</td>
                <td className="error-text">{reasonOf(m)}</td>
                <td>
                  {m.payload != null && (
                    <details>
                      <summary className="link">Show</summary>
                      <JsonView data={m.payload} />
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={(o) => { setOffset(o); setError(''); }} />
    </div>
  );
}
