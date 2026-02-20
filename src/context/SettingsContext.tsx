import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface Settings {
  refreshInterval: number;
  theme: Theme;
  showPayload: boolean;
  readOnly: boolean;
  wsEnabled: boolean;
}

interface SettingsContextValue extends Settings {
  setRefreshInterval: (ms: number) => void;
  setTheme: (theme: Theme) => void;
  setShowPayload: (show: boolean) => void;
  setReadOnly: (readOnly: boolean) => void;
  setWsEnabled: (enabled: boolean) => void;
}

const STORAGE_KEY = 'dureq_settings';

const defaults: Settings = {
  refreshInterval: 5000,
  theme: 'dark',
  showPayload: true,
  readOnly: false,
  wsEnabled: true,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults;
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (settings.theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  const value: SettingsContextValue = {
    ...settings,
    setRefreshInterval: (ms) => setSettings((s) => ({ ...s, refreshInterval: ms })),
    setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
    setShowPayload: (show) => setSettings((s) => ({ ...s, showPayload: show })),
    setReadOnly: (readOnly) => setSettings((s) => ({ ...s, readOnly })),
    setWsEnabled: (wsEnabled) => setSettings((s) => ({ ...s, wsEnabled })),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
