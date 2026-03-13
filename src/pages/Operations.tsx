import { useState } from 'react';
import { useLockInfo, useForceUnlock, useConcurrencyInfo, useRequeueRun, useGroups } from '../hooks';
import { useSettings } from '../context/useSettings';

function LockInspector() {
  const { readOnly } = useSettings();
  const [key, setKey] = useState('');
  const [search, setSearch] = useState('');
  const { data: lock, isLoading, error } = useLockInfo(search);
  const unlockMut = useForceUnlock();

  return (
    <div>
      <h3>Lock Inspector</h3>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Lock key (e.g. run:abc123)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(key)}
        />
        <button className="btn" onClick={() => setSearch(key)}>
          Inspect
        </button>
      </div>
      {isLoading && <p className="muted">Loading...</p>}
      {error && <p className="error-text">Error: {(error as Error).message}</p>}
      {lock && (
        <div className="detail" style={{ marginTop: '0.75rem' }}>
          <dl>
            <dt>Key</dt>
            <dd className="mono">{lock.key}</dd>
            <dt>Exists</dt>
            <dd>
              <span className={`badge badge-${lock.exists ? 'running' : 'cancelled'}`}>
                {lock.exists ? 'Yes' : 'No'}
              </span>
            </dd>
            {lock.exists && (
              <>
                <dt>Owner</dt>
                <dd className="mono">{lock.owner}</dd>
                <dt>TTL</dt>
                <dd>{lock.ttl}s</dd>
              </>
            )}
          </dl>
          {!readOnly && lock.exists && (
            <button
              className="btn btn-danger"
              onClick={() => unlockMut.mutate(lock.key)}
              disabled={unlockMut.isPending}
              style={{ marginTop: '0.5rem' }}
            >
              Force Unlock
            </button>
          )}
          {unlockMut.isSuccess && <span className="muted" style={{ marginLeft: 8 }}>Unlocked</span>}
        </div>
      )}
    </div>
  );
}

function ConcurrencyInspector() {
  const [key, setKey] = useState('');
  const [search, setSearch] = useState('');
  const { data: info, isLoading, error } = useConcurrencyInfo(search);

  return (
    <div>
      <h3>Concurrency Slots</h3>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Concurrency key (e.g. tenant:acme)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setSearch(key)}
        />
        <button className="btn" onClick={() => setSearch(key)}>
          Inspect
        </button>
      </div>
      {isLoading && <p className="muted">Loading...</p>}
      {error && <p className="error-text">Error: {(error as Error).message}</p>}
      {info && (
        <div className="detail" style={{ marginTop: '0.75rem' }}>
          <dl>
            <dt>Key</dt>
            <dd className="mono">{info.key}</dd>
            <dt>Active Slots</dt>
            <dd>
              <span className="badge badge-running">{info.active_slots}</span>
            </dd>
          </dl>
          {info.active_run_ids && info.active_run_ids.length > 0 && (
            <>
              <h4 style={{ color: '#c0c4d6', fontSize: '0.85rem', marginTop: '0.75rem' }}>Active Runs</h4>
              <table>
                <thead>
                  <tr>
                    <th>Run ID</th>
                  </tr>
                </thead>
                <tbody>
                  {info.active_run_ids.map((rid) => (
                    <tr key={rid}>
                      <td className="mono">{rid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RunRequeue() {
  const { readOnly } = useSettings();
  const [runId, setRunId] = useState('');
  const requeueMut = useRequeueRun();

  if (readOnly) return null;

  return (
    <div>
      <h3>Requeue Run</h3>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Run ID"
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && runId) requeueMut.mutate(runId);
          }}
        />
        <button
          className="btn btn-primary"
          onClick={() => requeueMut.mutate(runId)}
          disabled={requeueMut.isPending || !runId}
        >
          Requeue
        </button>
        {requeueMut.isSuccess && <span className="muted">Requeued</span>}
        {requeueMut.isError && (
          <span className="error-text">{(requeueMut.error as Error).message}</span>
        )}
      </div>
    </div>
  );
}

function GroupsList() {
  const { data: groups, isLoading } = useGroups();

  return (
    <div>
      <h3>Aggregation Groups</h3>
      {isLoading && <p className="muted">Loading...</p>}
      {groups && groups.length === 0 && <p className="muted">No active groups</p>}
      {groups && groups.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Group Name</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.name}>
                <td className="mono">{g.name}</td>
                <td>{g.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Operations() {
  return (
    <div className="page">
      <h2>Operations</h2>
      <div className="ops-grid">
        <div className="ops-section">
          <LockInspector />
        </div>
        <div className="ops-section">
          <ConcurrencyInspector />
        </div>
        <div className="ops-section">
          <RunRequeue />
        </div>
        <div className="ops-section">
          <GroupsList />
        </div>
      </div>
    </div>
  );
}
