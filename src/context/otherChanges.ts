// What has changed that is not on screen, by kind of list, so that a list can offer to be read
// again instead of moving its rows under the reader.

export type ListKind = 'jobs' | 'workflows' | 'batches';

const MAX = 1000;
const changes: Record<ListKind, Map<string, number>> = { jobs: new Map(), workflows: new Map(), batches: new Map() };
const listeners = new Set<() => void>();
let version = 0;

export function noteOtherChanges(kind: ListKind, ids: Iterable<string>) {
  const map = changes[kind];
  for (const id of ids) {
    map.delete(id);
    map.set(id, Date.now());
  }
  for (const id of map.keys()) {
    if (map.size <= MAX) break;
    map.delete(id);
  }
  version++;
  listeners.forEach((l) => l());
}

/** How many have changed since a list was read. */
export function countOtherChanges(kind: ListKind, since: number): number {
  let n = 0;
  for (const at of changes[kind].values()) if (at > since) n++;
  return n;
}

export const otherChanges = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => version,
};
