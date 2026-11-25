import { useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { eventLog } from '../context/eventLog';
import { useRecentEvents } from '../hooks';
import { eventKey, eventLabel, eventTarget, eventTone, formatTime, mergeEvents } from '../util';

/** The last events, newest first. */
export function ActivityFeed({ count = 14 }: { count?: number }) {
  const live = useSyncExternalStore(eventLog.subscribe, eventLog.get);
  const { data: past } = useRecentEvents(count);
  const events = mergeEvents(live, past ?? []).slice(0, count);
  if (events.length === 0) return <p className="muted">{past ? 'Nothing has happened yet.' : 'Loading...'}</p>;
  return (
    <ul className="plain-list feed">
      {events.map((e) => {
        const to = eventTarget(e);
        const what = <>{e.task_type ? <strong>{e.task_type} </strong> : null}{eventLabel(e.type)}{e.error && `: ${e.error}`}</>;
        return (
          <li key={eventKey(e)}>
            <time dateTime={e.timestamp}>{formatTime(e.timestamp)}</time>
            <i className={`swatch ${eventTone(e.type)}`} />
            <span className="grow" title={e.error}>{to ? <Link to={to}>{what}</Link> : what}</span>
          </li>
        );
      })}
    </ul>
  );
}
