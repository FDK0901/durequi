import { NavLink, Outlet } from 'react-router';
import '../App.css';
import { useSettings } from '../context/useSettings';
import { useWebSocketStatus } from '../context/useWebsocketStatus';
import { Toasts } from '../components/Toasts';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/runs', label: 'Runs' },
  { to: '/events', label: 'Events' },
  { to: '/nodes', label: 'Nodes' },
  { to: '/schedules', label: 'Schedules' },
  { to: '/queues', label: 'Queues' },
  { to: '/dlq', label: 'DLQ' },
  { to: '/workflows', label: 'Workflows' },
  { to: '/batches', label: 'Batches' },
  { to: '/audit', label: 'Audit' },
  { to: '/ops', label: 'Operations' },
  { to: '/search', label: 'Search' },
  { to: '/redis', label: 'Redis' },
  { to: '/settings', label: 'Settings' },
];

export default function RootLayout() {
  const { status } = useWebSocketStatus();
  const { refreshInterval } = useSettings();
  const statusColor =
    status === 'connected'
      ? '#4ade80'
      : status === 'connecting' || status === 'late'
        ? '#facc15'
        : '#6b7280';
  const statusLabel = {
    connected: 'Live',
    late: 'Live, but late',
    connecting: 'Connecting...',
    offline: 'Offline',
    disconnected: refreshInterval ? 'Polling' : 'Not refreshing',
  }[status];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          dureq
          <span title={statusLabel} style={{ marginLeft: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: statusColor,
              }}
            />
          </span>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}
