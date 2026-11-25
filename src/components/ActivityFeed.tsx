import { useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { eventLog, type LoggedEvent } from '../context/eventLog';
import { useWebSocketStatus } from '../context/useWebsocketStatus';
import { formatTime } from '../util';

function tone(type: string): string {
  if (/failed|dead|crash|panicked|timed_out|timeout/.test(type)) return 'failed';
  if (/retrying|auto_recovered/.test(type)) return 'retrying';
  if (/completed|resumed/.test(type)) return 'completed';
  if (/paused|suspended/.test(type)) return 'paused';
  if (/started|dispatched/.test(type)) return 'running';
  return 'skipped';
}

function target(e: LoggedEvent): string | null {
  if (e.workflow_id) return `/workflows/${e.workflow_id}`;
  if (!e.job_id) return null;
  if (e.type.startsWith('workflow.')) return `/workflows/${e.job_id}`;
  if (e.type.startsWith('batch.')) return `/batches/${e.job_id}`;
  return `/jobs/${e.job_id}`;
}

/** Events as they come in, newest first. */
export function ActivityFeed({ count = 14 }: { count?: number }) {
  const events = useSyncExternalStore(eventLog.subscribe, eventLog.get);
  const { status } = useWebSocketStatus();
  if (events.length === 0) {
    return (
      <p className="muted">
        {status === 'connected' ? 'Waiting for something to happen.' : 'Not connected. Events show up here while the WebSocket is live.'}
      </p>
    );
  }
  return (
    <ul className="plain-list feed">
      {events.slice(0, count).map((e) => {
        const to = target(e);
        const what = <>{e.task_type ? <strong>{e.task_type} </strong> : null}{e.type.replaceAll('_', ' ').replaceAll('.', ' ')}{e.error && `: ${e.error}`}</>;
        return (
          <li key={e.key}>
            <time dateTime={e.timestamp}>{formatTime(e.timestamp)}</time>
            <i className={`swatch tone-${tone(e.type)}`} />
            <span className="grow" title={e.error}>{to ? <Link to={to}>{what}</Link> : what}</span>
          </li>
        );
      })}
    </ul>
  );
}
