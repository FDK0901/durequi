import { useSettings } from '../context/useSettings';

const REFRESH_OPTIONS = [
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: 'Off', value: 0 },
];

const THEME_OPTIONS = [
  { label: 'Dark', value: 'dark' as const },
  { label: 'Light', value: 'light' as const },
  { label: 'System', value: 'system' as const },
];

export default function Settings() {
  const { refreshInterval, theme, showPayload, readOnly, wsEnabled, setRefreshInterval, setTheme, setShowPayload, setReadOnly, setWsEnabled } = useSettings();

  return (
    <div className="page">
      <h2>Settings</h2>

      <div className="settings-group">
        <h3>Refresh Interval</h3>
        <div className="settings-options">
          {REFRESH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`btn ${refreshInterval === opt.value ? 'btn-active' : ''}`}
              onClick={() => setRefreshInterval(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h3>Theme</h3>
        <div className="settings-options">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`btn ${theme === opt.value ? 'btn-active' : ''}`}
              onClick={() => setTheme(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h3>Display</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={showPayload}
            onChange={(e) => setShowPayload(e.target.checked)}
          />
          Show payload in job list
        </label>
      </div>

      <div className="settings-group">
        <h3>Access Control</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
          Read-only mode (hide all action buttons)
        </label>
      </div>

      <div className="settings-group">
        <h3>Real-time Updates</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={wsEnabled}
            onChange={(e) => setWsEnabled(e.target.checked)}
          />
          Enable WebSocket (live push updates)
        </label>
        <p className="settings-hint">
          When enabled, data updates are pushed in real-time via WebSocket.
          Polling is used as a fallback when disconnected.
        </p>
      </div>
    </div>
  );
}
