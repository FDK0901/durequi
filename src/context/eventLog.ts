import type { JobEvent } from '../api';

// The last events that came in over the WebSocket. Those before are in the event history
// of the API.

const MAX = 60;
let events: JobEvent[] = [];
const listeners = new Set<() => void>();

/** addEvents takes events in the order they happened; the log is newest first. */
export function addEvents(batch: JobEvent[]) {
  if (batch.length === 0) return;
  events = [...batch.slice(-MAX).reverse(), ...events].slice(0, MAX);
  listeners.forEach((l) => l());
}

export const eventLog = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => events,
};
