import { NavLink, Outlet } from 'react-router';
import '../App.css';
import { useWebSocketStatus } from '../context/useWebsocketStatus';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/runs', label: 'Runs' },
  { to: '/nodes', label: 'Nodes' },
  { to: '/schedules', label: 'Schedules' },
  { to: '/queues', label: 'Queues' },
  { to: '/dlq', label: 'DLQ' },
  { to: '/workflows', label: 'Workflows' },
  { to: '/batches', label: 'Batches' },
  { to: '/audit', label: 'Audit' },
  { to: '/search', label: 'Search' },
  { to: '/redis', label: 'Redis' },
  { to: '/settings', label: 'Settings' },
];

export default function RootLayout() {
  const { status } = useWebSocketStatus();
  const statusColor =
    status === 'connected'
      ? '#4ade80'
      : status === 'connecting'
        ? '#facc15'
        : '#6b7280';
  const statusLabel =
    status === 'connected'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting...'
        : 'Polling';

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          dureq
          <span title={`WebSocket: ${statusLabel}`} style={{ marginLeft: 8 }}>
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
    </div>
  );
}
