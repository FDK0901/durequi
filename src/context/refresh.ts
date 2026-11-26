import type { QueryClient, QueryKey } from '@tanstack/react-query';

// How often data is read again at most because of events, by the first part of its key.
const BUDGET_MS: Record<string, number> = {
  jobs: 3000,
  workflows: 3000,
  batches: 3000,
  historyRuns: 3000,
  jobRuns: 3000,
  jobAudit: 3000,
  schedules: 3000,
  activeRuns: 3000,
  dlq: 3000,
  auditCounts: 3000,
  batch: 5000, // all of its items
  batchResults: 5000,
  stats: 5000,
  nodes: 5000,
  dailyStats: 60_000,
};
const DEFAULT_BUDGET_MS = 1000;
const MAX_REMEMBERED = 500;

// Read when asked for, as it takes the API long (see hooks.ts).
const ON_DEMAND = new Set(['historyEvents', 'jobEvents', 'searchJobs', 'searchWorkflows', 'searchBatches', 'redisInfo']);

export interface Refresher {
  /** Has what is on screen of a key read again: soon, and once after what is being read now. */
  mark: (key: QueryKey) => void;
  /** Has everything on screen read again. */
  markAll: () => void;
  stop: () => void;
}

/**
 * Reads queries again that events have made out of date. One that is being read is not
 * cancelled, as that would leave it at its old state for as long as there are events, but
 * read once more when it is done. The longer the API takes, the less often it is asked.
 */
export function createRefresher(qc: QueryClient): Refresher {
  const dirty = new Map<string, QueryKey>();
  const last = new Map<string, { at: number; took: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function dueAt(id: string, key: QueryKey): number {
    const l = last.get(id);
    return l ? l.at + Math.max(BUDGET_MS[String(key[0])] ?? DEFAULT_BUDGET_MS, 2 * l.took) : 0;
  }

  function run() {
    timer = undefined;
    const now = Date.now();
    let next = Infinity;
    for (const [id, key] of dirty) {
      const due = dueAt(id, key);
      if (due > now) {
        next = Math.min(next, due);
        continue;
      }
      if (qc.isFetching({ queryKey: key }) > 0) {
        next = Math.min(next, now + 200);
        continue;
      }
      dirty.delete(id);
      last.delete(id); // so that what is used last is at the end
      last.set(id, { at: now, took: 0 });
      // What is hidden is only marked, and read when it is looked at.
      const hidden = document.hidden;
      void qc.invalidateQueries({ queryKey: key, refetchType: hidden ? 'none' : 'active' }).then(() => {
        if (!hidden) last.set(id, { at: Date.now(), took: Date.now() - now });
      });
    }
    for (const id of last.keys()) {
      if (last.size <= MAX_REMEMBERED) break;
      last.delete(id);
    }
    if (next < Infinity) timer = setTimeout(run, Math.max(50, next - Date.now()));
  }

  function mark(key: QueryKey) {
    dirty.set(JSON.stringify(key), key);
    clearTimeout(timer); // which may be one for later
    timer = setTimeout(run, 0);
  }

  return {
    mark,
    markAll() {
      for (const { queryKey } of qc.getQueryCache().findAll({ type: 'active' })) {
        if (!ON_DEMAND.has(String(queryKey[0]))) mark(queryKey);
      }
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
