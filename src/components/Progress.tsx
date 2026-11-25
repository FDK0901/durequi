import { readProgress } from '../util';
import { JsonView } from './JsonView';

/** Progress that a handler has reported. */
export function Progress({ value }: { value: unknown }) {
  const progress = readProgress(value);
  if (!progress) return null;
  if (progress.percent == null && !progress.message) return <JsonView data={value} />;
  return (
    <div style={{ marginTop: '1rem' }}>
      {progress.percent != null && (
        <div className="progress-bar">
          <div className="progress-fill progress-success" style={{ width: `${progress.percent}%` }} />
        </div>
      )}
      <div className="progress-stats">
        {progress.percent != null && <span>{Math.round(progress.percent)}%</span>}
        {progress.message && <span>{progress.message}</span>}
      </div>
    </div>
  );
}
