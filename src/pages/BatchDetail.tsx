import { useParams, useNavigate } from 'react-router';
import { useBatch, useBatchResults, useCancelBatch, useRetryBatch } from '../hooks';
import { useSettings } from '../context/SettingsContext';
import { timeAgo, formatCountdown } from '../util';
import { JsonView } from '../components/JsonView';
import type { BatchInstance, BatchItemResult } from '../api';
import { PriorityBadge } from '../components/PriorityBadge';

function ProgressBar({ batch }: { batch: BatchInstance }) {
  const done = batch.completed_items + batch.failed_items;
  const pct = batch.total_items > 0 ? (done / batch.total_items) * 100 : 0;
  const failPct = batch.total_items > 0 ? (batch.failed_items / batch.total_items) * 100 : 0;
  const successPct = pct - failPct;

  return (
    <div className="batch-progress">
      <div className="progress-bar">
        <div className="progress-fill progress-success" style={{ width: `${successPct}%` }} />
        <div className="progress-fill progress-fail" style={{ width: `${failPct}%` }} />
      </div>
      <div className="progress-stats">
        <span>{batch.completed_items} completed</span>
        {batch.failed_items > 0 && <span className="error-text">{batch.failed_items} failed</span>}
        <span>{batch.running_items} running</span>
        <span>{batch.pending_items} pending</span>
        <span className="progress-pct">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function ResultsTable({ results }: { results: BatchItemResult[] }) {
  if (results.length === 0) return <div className="empty-state">No results yet</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Item ID</th>
          <th>Status</th>
          <th>Output / Error</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.item_id}>
            <td className="mono">{r.item_id}</td>
            <td>
              <span className={`badge badge-${r.success ? 'completed' : 'failed'}`}>
                {r.success ? 'success' : 'failed'}
              </span>
            </td>
            <td>
              {r.success && r.output != null ? (
                <code className="mono">{JSON.stringify(r.output)}</code>
              ) : r.error ? (
                <span className="error-text">{r.error}</span>
              ) : (
                '-'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { readOnly } = useSettings();
  const { data: batch, isLoading, error } = useBatch(id!);
  const { data: results } = useBatchResults(id!);
  const cancelMut = useCancelBatch();
  const retryMut = useRetryBatch();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!batch) return <div className="error">Batch not found</div>;

  const isActive = batch.status === 'pending' || batch.status === 'running';
  const itemEntries = Object.values(batch.item_states);

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={() => navigate('/batches')}>Back</button>
        <h2>{batch.name}</h2>
        <span className={`badge badge-${batch.status}`}>{batch.status}</span>
        {!readOnly && isActive && (
          <button
            className="btn btn-danger"
            onClick={() => cancelMut.mutate(batch.id)}
            disabled={cancelMut.isPending}
          >
            Cancel Batch
          </button>
        )}
        {!readOnly && batch.status === 'failed' && (
          <>
            <button
              className="btn"
              onClick={() => retryMut.mutate({ id: batch.id, retryFailedOnly: true })}
              disabled={retryMut.isPending}
            >
              Retry Failed Items
            </button>
            <button
              className="btn"
              onClick={() => retryMut.mutate({ id: batch.id, retryFailedOnly: false })}
              disabled={retryMut.isPending}
            >
              Retry All
            </button>
          </>
        )}
      </div>

      <ProgressBar batch={batch} />

      <div className="detail">
        <dl>
          <dt>ID</dt>
          <dd className="mono">{batch.id}</dd>
          <dt>Item Task Type</dt>
          <dd>{batch.definition.item_task_type}</dd>
          {batch.definition.onetime_task_type && (
            <>
              <dt>Onetime Task Type</dt>
              <dd>{batch.definition.onetime_task_type}</dd>
            </>
          )}
          <dt>Priority</dt>
          <dd><PriorityBadge priority={batch.definition.default_priority} /></dd>
          <dt>Failure Policy</dt>
          <dd>{batch.definition.failure_policy || 'continue_on_error'}</dd>
          {batch.deadline && (
            <>
              <dt>Deadline</dt>
              <dd>{formatCountdown(batch.deadline)}</dd>
            </>
          )}
          {batch.attempt != null && batch.max_attempts != null && (
            <>
              <dt>Attempt</dt>
              <dd>{batch.attempt} / {batch.max_attempts}</dd>
            </>
          )}
          <dt>Chunk Size</dt>
          <dd>{batch.definition.chunk_size || 100}</dd>
          <dt>Created</dt>
          <dd>{timeAgo(batch.created_at)}</dd>
          <dt>Updated</dt>
          <dd>{timeAgo(batch.updated_at)}</dd>
          {batch.completed_at && (
            <>
              <dt>Completed</dt>
              <dd>{timeAgo(batch.completed_at)}</dd>
            </>
          )}
        </dl>
      </div>

      {batch.onetime_state && (
        <>
          <h3>Onetime Preprocessing</h3>
          <div className="detail">
            <dl>
              <dt>Status</dt>
              <dd>
                <span className={`badge badge-${batch.onetime_state.status}`}>
                  {batch.onetime_state.status}
                </span>
              </dd>
              {batch.onetime_state.job_id && (
                <>
                  <dt>Job ID</dt>
                  <dd>
                    <span className="link mono" onClick={() => navigate(`/jobs/${batch.onetime_state!.job_id}`)}>
                      {batch.onetime_state.job_id.substring(0, 12)}...
                    </span>
                  </dd>
                </>
              )}
              {batch.onetime_state.error && (
                <>
                  <dt>Error</dt>
                  <dd className="error-text">{batch.onetime_state.error}</dd>
                </>
              )}
              {batch.onetime_state.started_at && (
                <>
                  <dt>Started</dt>
                  <dd>{timeAgo(batch.onetime_state.started_at)}</dd>
                </>
              )}
              {batch.onetime_state.finished_at && (
                <>
                  <dt>Finished</dt>
                  <dd>{timeAgo(batch.onetime_state.finished_at)}</dd>
                </>
              )}
            </dl>
            {batch.onetime_state.result_data != null && (
              <>
                <h3>Onetime Result</h3>
                <JsonView data={batch.onetime_state.result_data} />
              </>
            )}
          </div>
        </>
      )}

      <h3>Items ({itemEntries.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Item ID</th>
            <th>Status</th>
            <th>Job ID</th>
            <th>Error</th>
            <th>Started</th>
            <th>Finished</th>
          </tr>
        </thead>
        <tbody>
          {itemEntries.map((item) => (
            <tr key={item.item_id}>
              <td className="mono">{item.item_id}</td>
              <td>
                <span className={`badge badge-${item.status}`}>{item.status}</span>
              </td>
              <td className="mono">
                {item.job_id ? (
                  <span className="link" onClick={() => navigate(`/jobs/${item.job_id}`)}>
                    {item.job_id.substring(0, 12)}...
                  </span>
                ) : '-'}
              </td>
              <td>{item.error ? <span className="error-text">{item.error}</span> : '-'}</td>
              <td>{item.started_at ? timeAgo(item.started_at) : '-'}</td>
              <td>{item.finished_at ? timeAgo(item.finished_at) : '-'}</td>
            </tr>
          ))}
          {itemEntries.length === 0 && (
            <tr>
              <td colSpan={6} className="empty">No items</td>
            </tr>
          )}
        </tbody>
      </table>

      {results && results.length > 0 && (
        <>
          <h3>Results ({results.length})</h3>
          <ResultsTable results={results} />
        </>
      )}

      {batch.definition.onetime_payload != null && (
        <>
          <h3>Onetime Payload</h3>
          <JsonView data={batch.definition.onetime_payload} />
        </>
      )}
    </div>
  );
}
