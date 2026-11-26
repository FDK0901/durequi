import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

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
  /**
   * Has everything on screen read again, as events may have been missed: now, after a
   * connection, or else not sooner after the last time than floor, the refresh interval;
   * what is polled that often is left to it then.
   */
  markAll: (how?: { now?: boolean; floor?: number }) => void;
  stop: () => void;
}

interface Dirty {
  key: QueryKey;
  /** When it was marked last. */
  at: number;
  /** By an event, which says that something has changed. */
  event: boolean;
  /** Whatever the budget. */
  now: boolean;
  floor: number;
}

/**
 * Reads queries again that events have made out of date. One that is being read is not
 * cancelled, as that would leave it at its old state for as long as there are events, but
 * read once more when it is done. The longer the API takes, the less often it is asked.
 */
export function createRefresher(qc: QueryClient): Refresher {
  const dirty = new Map<string, Dirty>();
  const last = new Map<string, { at: number; took: number }>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // When each query began to be read last, by whom ever: polling, a page that is opened.
  const began = new Map<string, number>();
  let unsubscribe: (() => void) | undefined;
  function watch() {
    unsubscribe ??= qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'fetch') began.set(e.query.queryHash, Date.now());
      else if (e.type === 'removed') began.delete(e.query.queryHash);
    });
  }
  watch();

  /**
   * Whether all that is on screen of it has been read since it was marked. For an event, the
   * read has to have begun after it; a read that was on its way may be older than the change.
   * For everything at once, which only says that something may have been missed, it is enough
   * that the data came after.
   */
  function isRead(d: Dirty): boolean {
    const queries = qc.getQueryCache().findAll({ queryKey: d.key, type: 'active' });
    const read = (q: Query) => {
      const { dataUpdatedAt } = q.state;
      if (!d.event) return dataUpdatedAt > d.at;
      const from = began.get(q.queryHash);
      return from !== undefined && from >= d.at && dataUpdatedAt >= from;
    };
    return queries.length > 0 && queries.every(read);
  }

  /** How often it is polled, by the observer that asks most often. */
  function polledEvery(q: Query): number {
    let every = Infinity;
    for (const { options } of q.observers) {
      if (typeof options.refetchInterval === 'number' && options.refetchInterval > 0) every = Math.min(every, options.refetchInterval);
    }
    return every;
  }

  function dueAt(id: string, d: Dirty): number {
    const l = last.get(id);
    if (!l || d.now) return 0;
    const floor = d.event ? 0 : d.floor;
    return l.at + Math.max(BUDGET_MS[String(d.key[0])] ?? DEFAULT_BUDGET_MS, 2 * l.took, floor);
  }

  function run() {
    timer = undefined;
    const now = Date.now();
    let next = Infinity;
    for (const [id, d] of dirty) {
      if (isRead(d)) {
        dirty.delete(id);
        continue;
      }
      const due = dueAt(id, d);
      if (due > now) {
        next = Math.min(next, due);
        continue;
      }
      if (qc.isFetching({ queryKey: d.key }) > 0) {
        next = Math.min(next, now + 200);
        continue;
      }
      dirty.delete(id);
      last.delete(id); // so that what is used last is at the end
      last.set(id, { at: now, took: 0 });
      // What is hidden is only marked, and read when it is looked at.
      const hidden = document.hidden;
      void qc.invalidateQueries({ queryKey: d.key, refetchType: hidden ? 'none' : 'active' }).then(() => {
        if (!hidden) last.set(id, { at: Date.now(), took: Date.now() - now });
      });
    }
    for (const id of last.keys()) {
      if (last.size <= MAX_REMEMBERED) break;
      last.delete(id);
    }
    if (next < Infinity) timer = setTimeout(run, Math.max(50, next - Date.now()));
  }

  function put(key: QueryKey, change: (d: Dirty) => void) {
    watch();
    const id = JSON.stringify(key);
    const d = dirty.get(id) ?? { key, at: 0, event: false, now: false, floor: 0 };
    d.at = Date.now();
    change(d);
    dirty.set(id, d);
    clearTimeout(timer); // which may be one for later
    timer = setTimeout(run, 0);
  }

  return {
    mark(key) {
      put(key, (d) => {
        d.event = true;
      });
    },
    markAll({ now = false, floor = 0 } = {}) {
      for (const query of qc.getQueryCache().findAll({ type: 'active' })) {
        if (ON_DEMAND.has(String(query.queryKey[0])) || (floor && polledEvery(query) <= floor)) continue;
        put(query.queryKey, (d) => {
          d.now ||= now;
          d.floor = Math.max(d.floor, floor);
        });
      }
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
}
