import { Link } from 'react-router';
import type { JobEvent } from '../api';
import { eventKey, eventLabel, eventTarget, eventTone, formatDateTime, shortId } from '../util';

export function EventTable({ events, subject = true }: { events: JobEvent[]; subject?: boolean }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Event</th>
          {subject && <th>Of</th>}
          <th>Run</th>
          <th>Node</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => {
          const to = eventTarget(e);
          return (
            <tr key={eventKey(e)}>
              <td><time dateTime={e.timestamp}>{formatDateTime(e.timestamp)}</time></td>
              <td><i className={`swatch ${eventTone(e.type)}`} /> {eventLabel(e.type)}</td>
              {subject && (
                <td>
                  {e.task_type && `${e.task_type} `}
                  {to ? <Link className="link mono" to={to}>{shortId(to.slice(to.lastIndexOf('/') + 1))}</Link> : '-'}
                </td>
              )}
              <td>{e.run_id ? <Link className="link mono" to={`/runs?run=${e.run_id}`}>{shortId(e.run_id)}</Link> : '-'}</td>
              <td>{e.node_id || '-'}</td>
              <td className="error-cell">{e.error}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
