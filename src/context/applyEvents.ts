import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';
import type { BatchInstance, BatchProgress, Job, JobEvent, JobListParams, Paginated } from '../api';
import { loadJobs, readsManyAtOnce } from '../loaders';
import type { Refresher } from './refresh';
import { noteOtherChanges, type ListKind } from './otherChanges';

/** Rows are read again at most that often. */
const ROWS_MS = 1000;

const JOB_ENDS = new Set(['job.completed', 'job.failed', 'job.dead', 'job.cancelled', 'job.paused']);
const JOB_KEYS = new Set(['job.dead', 'job.failed', 'job.cancelled', 'job.paused', 'job.resumed', 'job.deleted']);

type Row = { id: string };

/** Changes rows of the lists on screen, without making them look newly read. */
function patchRows<T extends Row>(qc: QueryClient, refresher: Refresher, kind: ListKind, change: (row: T) => T) {
  for (const query of qc.getQueryCache().findAll({ queryKey: [kind], type: 'active' })) {
    const page = query.state.data as Paginated<T> | undefined;
    if (!page?.data) continue;
    const rows = page.data.map(change);
    if (rows.some((row, i) => row !== page.data![i])) {
      qc.setQueryData(query.queryKey, { ...page, data: rows }, { updatedAt: query.state.dataUpdatedAt });
    }
    // What is on its way may be older.
    if (query.state.fetchStatus !== 'idle') refresher.mark(query.queryKey);
  }
}

/** Whether a job is one that a list asks for. The API filters by the first of these given. */
function fits(params: JobListParams | undefined, job: Job): boolean {
  if (params?.status) return job.status === params.status;
  if (params?.task_type) return job.task_type === params.task_type;
  if (params?.tag) return job.tags?.includes(params.tag) ?? false;
  return true;
}

/** Lists of jobs that show a row that is no longer what they ask for, and so have other rows now. */
function markLeftRows(qc: QueryClient, refresher: Refresher, changed: Map<string, Job>) {
  for (const query of qc.getQueryCache().findAll({ queryKey: ['jobs'], type: 'active' })) {
    const params = query.queryKey[1] as JobListParams | undefined;
    const rows = (query.state.data as Paginated<Job> | undefined)?.data ?? [];
    if (rows.some((row) => changed.has(row.id) && !fits(params, row))) refresher.mark(query.queryKey);
  }
}

function withProgress(b: BatchInstance, { done, failed, total }: BatchProgress): BatchInstance {
  if (b.completed_items + b.failed_items === done && b.failed_items === failed && b.total_items === total) return b;
  // It does not say how many of those that are left are running.
  const running = Math.min(b.running_items, Math.max(0, total - done));
  return {
    ...b,
    completed_items: done - failed,
    failed_items: failed,
    total_items: total,
    running_items: running,
    pending_items: Math.max(0, total - done - running),
  };
}

/**
 * Applies events to what is on screen: what they prove is changed in place, and of the rest only
 * what they are about is read again. What is in no list on screen is only counted.
 *
 * Not everything is announced. These are read regularly instead: stats, nodes, queues, active
 * runs, schedules, progress, groups, locks. And everything is, slowly (see hooks.ts).
 */
export function createEventHandler(qc: QueryClient, refresher: Refresher) {
  // Job rows on screen that have to be read again.
  const rows = new Set<string>();
  let reading = false;

  async function readRows() {
    if (reading || rows.size === 0) return;
    const ids = [...rows];
    rows.clear();
    if (document.hidden) {
      void qc.invalidateQueries({ queryKey: ['jobs'], refetchType: 'none' });
      return;
    }
    if (ids.length > 2 && !readsManyAtOnce()) {
      refresher.mark(['jobs']); // the list takes one request
      return;
    }
    reading = true;
    const start = Date.now();
    try {
      const jobs = await loadJobs(ids);
      patchRows<Job>(qc, refresher, 'jobs', (row) => jobs.get(row.id) ?? row);
      markLeftRows(qc, refresher, jobs);
      if (ids.some((id) => !jobs.has(id))) refresher.mark(['jobs']); // deleted
    } catch {
      refresher.mark(['jobs']);
    }
    // What has changed meanwhile is read later, the later the longer this took.
    setTimeout(() => {
      reading = false;
      void readRows();
    }, Math.max(ROWS_MS, 2 * (Date.now() - start)));
  }

  /** pollOff: nothing is read regularly, so events have to do for that, too. */
  return function apply(events: JobEvent[], pollOff: boolean) {
    const active = new Map<string, Query[]>();
    for (const query of qc.getQueryCache().findAll({ type: 'active' })) {
      const root = String(query.queryKey[0]);
      if (!active.has(root)) active.set(root, []);
      active.get(root)!.push(query);
    }
    const marked = new Map<string, QueryKey>();
    const mark = (key: QueryKey) => {
      if (active.has(String(key[0]))) marked.set(JSON.stringify(key), key);
    };
    const ids = new Map([...active].map(([root, queries]) => [root, new Set(queries.map((q) => q.queryKey[1]))]));
    const markOne = (root: string, id: string) => {
      if (ids.get(root)?.has(id)) mark([root, id]);
    };
    const shown = (kind: ListKind) =>
      new Set((active.get(kind) ?? []).flatMap((q) => ((q.state.data as Paginated<Row> | undefined)?.data ?? []).map((r) => r.id)));
    const jobs = shown('jobs');
    const workflows = shown('workflows');
    const batches = shown('batches');
    const others: Record<ListKind, Set<string>> = { jobs: new Set(), workflows: new Set(), batches: new Set() };
    const changedRows = new Set<string>();

    for (const e of events) {
      const { type, job_id: id } = e;
      if (type.startsWith('job.')) {
        if (!id) continue;
        for (const root of ['job', 'jobRuns', 'jobAudit']) markOne(root, id);
        if (e.workflow_id) markOne('workflow', e.workflow_id);
        if (jobs.has(id)) changedRows.add(id);
        else others.jobs.add(id);
        if (type === 'job.deleted' && jobs.has(id)) mark(['jobs']);
        if (JOB_ENDS.has(type)) {
          mark(['historyRuns']);
          mark(['dailyStats']);
        }
        if (type === 'job.failed' || type === 'job.dead') mark(['dlq']);
        if (JOB_KEYS.has(type)) mark(['uniqueKey']);
        if (JOB_KEYS.has(type) && type !== 'job.failed') mark(['schedules']);
      } else if (type.startsWith('workflow.')) {
        const wf = e.workflow_id ?? id;
        if (!wf) continue;
        markOne('workflow', wf);
        markOne('workflowAudit', wf);
        markOne('workflowSignalStats', wf);
        if (workflows.has(wf)) mark(['workflows']);
        else others.workflows.add(wf);
      } else if (type.startsWith('batch.')) {
        const progress = e.batch_progress;
        const batch = progress?.batch_id ?? id;
        if (!batch) continue;
        if (progress) {
          const change = (b: BatchInstance) => (b.id === batch ? withProgress(b, progress) : b);
          patchRows<BatchInstance>(qc, refresher, 'batches', change);
          const detail = qc.getQueryState<BatchInstance>(['batch', batch]);
          if (detail?.data) qc.setQueryData(['batch', batch], change(detail.data), { updatedAt: detail.dataUpdatedAt });
          if (detail?.data && detail.fetchStatus !== 'idle') mark(['batch', batch]);
          continue;
        }
        markOne('batch', batch);
        markOne('batchResults', batch);
        if (type.startsWith('batch.item.') || type.startsWith('batch.onetime.')) continue; // the progress says it
        if (batches.has(batch)) mark(['batches']);
        else others.batches.add(batch);
      } else if (type.startsWith('node.')) {
        mark(['nodes']);
        for (const run of e.affected_run_ids ?? []) markOne('run', run);
      } else if (type.startsWith('schedule.')) {
        mark(['schedules']);
        if (id) markOne('job', id);
      }
      if (e.run_id) markOne('run', e.run_id);
    }
    if (pollOff && events.length > 0) {
      for (const root of ['stats', 'activeRuns', 'nodes', 'queues']) mark([root]);
    }

    for (const key of marked.values()) refresher.mark(key);
    for (const kind of ['jobs', 'workflows', 'batches'] as const) {
      if (others[kind].size > 0) noteOtherChanges(kind, others[kind]);
    }
    if (changedRows.size > 0) {
      for (const query of active.get('auditCounts') ?? []) {
        if ((query.queryKey[1] as string[]).some((id) => changedRows.has(id))) refresher.mark(query.queryKey);
      }
      for (const id of changedRows) rows.add(id);
      void readRows();
    }
  };
}
