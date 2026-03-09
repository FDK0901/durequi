import { createContext } from 'react';
import type { SettingsContextValue } from './settings';

export const SettingsContext = createContext<SettingsContextValue | null>(null);

