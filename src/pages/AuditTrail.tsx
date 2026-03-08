import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useJobAuditTrail } from '../hooks';
import { timeAgo } from '../util';

export default function AuditTrail() {
  const [jobId, setJobId] = useState('');
  const [searchId, setSearchId] = useState('');
  const navigate = useNavigate();
  const { data: entries, isLoading, error } = useJobAuditTrail(searchId);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchId(jobId.trim());
  }

  return (
    <div className="page">
      <h2>Audit Trail</h2>

      <form onSubmit={handleSearch} className="toolbar" style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Enter Job ID..."
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" type="submit" disabled={!jobId.trim()}>
          Search
        </button>
      </form>

      {isLoading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {searchId && !isLoading && !error && (
        <>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Job:</strong>{' '}
            <span
              className="mono link"
              onClick={() => navigate(`/jobs/${searchId}`)}
            >
              {searchId}
            </span>
            {entries && <span style={{ marginLeft: '1rem' }}>{entries.length} entries</span>}
          </div>

          {entries && entries.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Error</th>
                  <th>Stream ID</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{timeAgo(entry.timestamp)}</td>
                    <td><span className={`badge badge-${entry.status}`}>{entry.status}</span></td>
                    <td className="error-text">{entry.error || '-'}</td>
                    <td className="mono">{entry.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No audit entries found for this job.</p>
          )}
        </>
      )}

      {!searchId && (
        <p>Enter a Job ID above to view its state transition history. You can also view audit trails from the <span className="link" onClick={() => navigate('/jobs')}>Jobs</span> page by clicking on a job.</p>
      )}
    </div>
  );
}
