type Theme = 'dark' | 'light' | 'system';

export interface Settings {
    refreshInterval: number;
    theme: Theme;
    showPayload: boolean;
    readOnly: boolean;
    wsEnabled: boolean;
}

export interface SettingsContextValue extends Settings {
    setRefreshInterval: (ms: number) => void;
    setTheme: (theme: Theme) => void;
    setShowPayload: (show: boolean) => void;
    setReadOnly: (readOnly: boolean) => void;
    setWsEnabled: (enabled: boolean) => void;
}