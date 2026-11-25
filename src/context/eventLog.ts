import type { JobEvent } from '../api';

// The last events that came in over the WebSocket. The API has no list of past events,
// so this starts empty with every page load.

export interface LoggedEvent extends JobEvent {
  key: number;
}

const MAX = 60;
let events: LoggedEvent[] = [];
let nextKey = 1;
const listeners = new Set<() => void>();

/** addEvents takes events in the order they happened; the log is newest first. */
export function addEvents(batch: JobEvent[]) {
  if (batch.length === 0) return;
  const added = batch.slice(-MAX).map((e) => ({ ...e, key: nextKey++ })).reverse();
  events = [...added, ...events].slice(0, MAX);
  listeners.forEach((l) => l());
}

export const eventLog = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => events,
};
