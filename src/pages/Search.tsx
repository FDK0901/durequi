import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSearchJobsByPayload, useSearchWorkflowsByPayload, useSearchBatchesByPayload, useCheckUniqueKey, useDeleteUniqueKey, useJobsById } from '../hooks';
import { useSettings } from '../context/useSettings';

type SearchTarget = 'jobs' | 'workflows' | 'batches';

export default function Search() {
  const navigate = useNavigate();
  const { readOnly } = useSettings();

  // Payload search state
  const [target, setTarget] = useState<SearchTarget>('jobs');
  const [jsonPath, setJsonPath] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [submittedPath, setSubmittedPath] = useState('');
  const [submittedValue, setSubmittedValue] = useState('');
  const [submittedTarget, setSubmittedTarget] = useState<SearchTarget>('jobs');
  const [taskType, setTaskType] = useState('');
  const [submittedTaskType, setSubmittedTaskType] = useState('');

  // Unique key state
  const [uniqueKey, setUniqueKey] = useState('');
  const [submittedKey, setSubmittedKey] = useState('');

  const jobResult = useSearchJobsByPayload(
    submittedTarget === 'jobs' ? submittedPath : '',
    submittedTarget === 'jobs' ? submittedValue : '',
    submittedTaskType || undefined,
  );
  const wfResult = useSearchWorkflowsByPayload(
    submittedTarget === 'workflows' ? submittedPath : '',
    submittedTarget === 'workflows' ? submittedValue : '',
  );
  const batchResult = useSearchBatchesByPayload(
    submittedTarget === 'batches' ? submittedPath : '',
    submittedTarget === 'batches' ? submittedValue : '',
  );

  const uniqueKeyResult = useCheckUniqueKey(submittedKey);
  const deleteUniqueKey = useDeleteUniqueKey();
  const holderId = uniqueKeyResult.data?.exists ? uniqueKeyResult.data.job_id : '';
  const holder = useJobsById(holderId ? [holderId] : []).get(holderId);

  function handlePayloadSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedPath(jsonPath);
    setSubmittedValue(searchValue);
    setSubmittedTarget(target);
    setSubmittedTaskType(target === 'jobs' ? taskType.trim() : '');
  }

  function handleUniqueKeySearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedKey(uniqueKey);
  }

  const activeResult = submittedTarget === 'jobs' ? jobResult : submittedTarget === 'workflows' ? wfResult : batchResult;

  return (
    <div className="page">
      <h2>Payload Search</h2>
      <p className="hint">Search jobs, workflows, or batches by JSONPath in their payload. Example path: <code>user.email</code>. Finds the newest match, whatever its status. Needs RedisJSON.</p>

      <form onSubmit={handlePayloadSearch} className="search-form">
        <select value={target} onChange={(e) => setTarget(e.target.value as SearchTarget)}>
          <option value="jobs">Jobs</option>
          <option value="workflows">Workflows</option>
          <option value="batches">Batches</option>
        </select>
        <input
          type="text"
          placeholder="JSONPath (e.g. user.email)"
          value={jsonPath}
          onChange={(e) => setJsonPath(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Value to match"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          required
        />
        {target === 'jobs' && (
          <input
            type="text"
            placeholder="Task type (optional)"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
          />
        )}
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {submittedPath && submittedValue && (
        <div className="search-results">
          {activeResult.isLoading && <div className="loading">Searching...</div>}
          {activeResult.error && <div className="error">Not found or error: {activeResult.error.message}</div>}
          {activeResult.data && (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">{(activeResult.data as { id: string }).id}</td>
                  <td>{submittedTarget}</td>
                  <td>
                    <span className={`badge badge-${(activeResult.data as { status: string }).status}`}>
                      {(activeResult.data as { status: string }).status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/${submittedTarget}/${(activeResult.data as { id: string }).id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <h2>Unique Key Lookup</h2>
      <p className="hint">Check who holds a deduplication key. A job keeps its key until it goes dead, is cancelled or is deleted; a completed one keeps it, too.</p>

      <form onSubmit={handleUniqueKeySearch} className="search-form">
        <input
          type="text"
          placeholder="Unique key..."
          value={uniqueKey}
          onChange={(e) => setUniqueKey(e.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit">Lookup</button>
      </form>

      {submittedKey && (
        <div className="search-results">
          {uniqueKeyResult.isLoading && <div className="loading">Looking up...</div>}
          {uniqueKeyResult.error && <div className="error">Error: {uniqueKeyResult.error.message}</div>}
          {uniqueKeyResult.data && (
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Exists</th>
                  <th>Job ID</th>
                  <th>Job Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">{submittedKey}</td>
                  <td>
                    <span className={`badge ${uniqueKeyResult.data.exists ? 'badge-running' : 'badge-cancelled'}`}>
                      {uniqueKeyResult.data.exists ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="mono">
                    {uniqueKeyResult.data.job_id ? (
                      <a onClick={() => navigate(`/jobs/${uniqueKeyResult.data!.job_id}`)} style={{ cursor: 'pointer' }}>
                        {uniqueKeyResult.data.job_id.substring(0, 16)}...
                      </a>
                    ) : '-'}
                  </td>
                  <td>
                    {holder ? <span className={`badge badge-${holder.status}`}>{holder.status}</span> : holderId ? 'no such job' : '-'}
                  </td>
                  <td>
                    {!readOnly && uniqueKeyResult.data.exists && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          if (confirm(`Delete unique key "${submittedKey}"? Another job can then be enqueued next to the one that holds it.`)) {
                            deleteUniqueKey.mutate(submittedKey);
                          }
                        }}
                        disabled={deleteUniqueKey.isPending}
                      >
                        Delete Key
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
