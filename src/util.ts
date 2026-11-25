import type { Job, JobRun, RetryPolicy, Schedule } from './api';

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatCountdown(iso: string): string {
  const remaining = new Date(iso).getTime() - Date.now();
  if (remaining <= 0) return 'expired';
  return `${formatMs(remaining)} remaining`;
}

/** A firing that is overdue by more than this is late. */
export const LATE_MS = 10_000;

/** When something is due that lies this far ahead. */
export function formatDue(ms: number): string {
  if (ms < -LATE_MS) return `${formatMs(-ms)} late`;
  return ms < 1000 ? 'now' : `in ${formatMs(ms)}`;
}

/** formatMs prints a span of time with at most two units. */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 10) return `${Number(s.toFixed(1))}s`;
  if (s < 60) return `${Math.round(s)}s`;
  const units: [string, number][] = [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]];
  let rest = Math.round(s);
  const parts: string[] = [];
  for (const [unit, size] of units) {
    const n = Math.floor(rest / size);
    if (n === 0 && parts.length === 0) continue;
    if (n > 0) parts.push(`${n}${unit}`);
    rest -= n * size;
    if (parts.length === 2 || rest === 0) break;
  }
  return parts.join(' ');
}

/** formatNs prints a Go duration in nanoseconds. */
export function formatNs(ns?: number): string {
  return ns ? formatMs(ns / 1_000_000) : '-';
}

export function formatTime(t: number | string | Date): string {
  return new Date(t).toLocaleTimeString();
}

export function formatDateTime(t: number | string | Date): string {
  return new Date(t).toLocaleString();
}

export function shortId(id: string, length = 12): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

/** parseGoDuration reads a duration such as "1h30m" and returns milliseconds, or 0. */
export function parseGoDuration(text?: string): number {
  if (!text) return 0;
  const size: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1000, ms: 1, µs: 0.001, us: 0.001, ns: 0.000001 };
  let ms = 0;
  for (const [, n, unit] of text.matchAll(/(\d+(?:\.\d+)?)(h|ms|µs|us|ns|m|s)/g)) ms += Number(n) * size[unit];
  return ms;
}

const RECURRING = ['DURATION', 'CRON', 'DAILY', 'WEEKLY', 'MONTHLY'];

export function isRecurring(schedule: Schedule): boolean {
  return RECURRING.includes(schedule.type);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** describeSchedule says in words when a job runs. */
export function describeSchedule(s: Schedule): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const at = (s.at_times ?? [])
    .map((t) => `${pad(t.hour)}:${pad(t.minute)}${t.second ? `:${pad(t.second)}` : ''}`)
    .join(', ');
  const n = s.regular_interval ?? 1;
  const each = (unit: string) => (n === 1 ? `every ${unit}` : `every ${n} ${unit}s`);
  switch (s.type) {
    case 'IMMEDIATE':
      return 'immediately';
    case 'ONE_TIME':
      return s.run_at ? `once at ${formatDateTime(s.run_at)}` : 'once';
    case 'DURATION':
      return s.interval ? `every ${formatMs(parseGoDuration(s.interval))}` : 'at an interval';
    case 'CRON':
      return `cron ${s.cron_expr ?? ''}`;
    case 'DAILY':
      return `${each('day')} at ${at}`;
    case 'WEEKLY':
      return `${each('week')} on ${(s.included_days ?? []).map((d) => WEEKDAYS[d] ?? d).join(', ')} at ${at}`;
    case 'MONTHLY':
      return `${each('month')} on day ${(s.included_days ?? []).join(', ')} at ${at}`;
    default:
      return s.type;
  }
}

/** describeOverlap says what happens when a firing is due while a run is going. */
export function describeOverlap(s: Schedule): string {
  switch (s.overlap_policy) {
    case 'SKIP':
      return 'skipped while a run is going';
    case 'BUFFER_ONE':
      return 'one firing waits for the run that is going';
    case 'BUFFER_ALL':
      return 'all firings wait for the run that is going';
    case 'REPLACE':
      return 'replaces the run that is going';
    default:
      return 'runs may overlap';
  }
}

const DEFAULT_RETRY: RetryPolicy = {
  max_attempts: 3,
  initial_delay: 5e9,
  max_delay: 300e9,
  multiplier: 2,
  jitter: 0.1,
};

/**
 * retryPolicyOf returns the policy of a job. A job without one uses that of its
 * handler, which the API does not tell, or else the default of dureq.
 */
export function retryPolicyOf(job: Job): { policy: RetryPolicy; own: boolean; limit: number } {
  const policy = job.retry_policy ?? DEFAULT_RETRY;
  const limit = job.dlq_after != null ? Math.min(job.dlq_after, policy.max_attempts) : policy.max_attempts;
  return { policy, own: job.retry_policy != null, limit };
}

/** retryDelays returns the waiting times (ms, without jitter) before attempts 2..n. */
export function retryDelays(policy: RetryPolicy, attempts: number): number[] {
  return Array.from({ length: Math.max(0, attempts - 1) }, (_, i) =>
    Math.min(policy.initial_delay * Math.pow(policy.multiplier || 1, i), policy.max_delay || Infinity) / 1e6,
  );
}

export type Outcome = 'running' | 'succeeded' | 'recovered' | 'failed' | 'stopped';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  running: 'Running',
  succeeded: 'Succeeded',
  recovered: 'Succeeded after a retry',
  failed: 'Failed',
  stopped: 'Cancelled',
};

/**
 * outcomeOf classifies a run. A retry goes on under the ID of the run that failed, so
 * a run of a later attempt that succeeded has failed before. Versions before v0.2.5,
 * which did not record the operation, counted attempts over the job's whole life.
 */
export function outcomeOf(run: JobRun): Outcome {
  switch (run.status) {
    case 'succeeded':
      return run.attempt > 0 && run.operation_key ? 'recovered' : 'succeeded';
    case 'failed':
    case 'timed_out':
      return 'failed';
    case 'cancelled':
      return 'stopped';
    default:
      return 'running';
  }
}

export function startOf(run: JobRun): number {
  return new Date(run.started_at).getTime();
}

/** When a run ended, or now if it is still going. */
export function endOf(run: JobRun, now: number): number {
  return outcomeOf(run) === 'running' ? now : startOf(run) + run.duration / 1e6;
}

/**
 * The active runs and the finished ones after them. A run can be in both: it has finished
 * since the active ones were read, or it is retried, which goes on under the same ID.
 */
export function mergeRuns(active: JobRun[], finished: JobRun[]): JobRun[] {
  const attempts = new Map(finished.map((r) => [r.id, r.attempt]));
  const current = active.filter((r) => r.attempt > (attempts.get(r.id) ?? -1));
  const ids = new Set(current.map((r) => r.id));
  return [...current, ...finished.filter((r) => !ids.has(r.id))];
}

/** describeOperation reads the operation key of a run. */
export function describeOperation(run: JobRun): string | null {
  const key = run.operation_key;
  if (!key) return null;
  if (key === run.job_id) return 'The job itself';
  if (key === run.id) return 'This run on its own (buffered, backfilled, resumed or retried by hand)';
  const firing = key.match(/^[^:]+:(\d{13})$/);
  if (firing) return `Firing of ${formatDateTime(Number(firing[1]))}`;
  const item = key.match(/^[^:]+:item:(.+)$/);
  if (item) return `Batch item ${item[1]}`;
  if (/^[^:]+:onetime$/.test(key)) return 'Preprocessing of a batch';
  const hook = key.match(/^[^:]+:hook:(.+)$/);
  if (hook) return `Workflow hook ${hook[1]}`;
  const task = key.match(/^[^:]+:(.+):(\d+)$/);
  if (task) return `Workflow task ${task[1]}${task[2] === '0' ? '' : `, iteration ${task[2]}`}`;
  return key;
}

/** readProgress makes sense of the usual ways in which handlers report progress. */
export function readProgress(progress: unknown): { percent?: number; message?: string } | null {
  if (progress == null) return null;
  if (typeof progress === 'number') return { percent: clampPercent(progress) };
  if (typeof progress === 'string') return { message: progress };
  if (typeof progress !== 'object') return { message: String(progress) };
  const p = progress as Record<string, unknown>;
  const raw = [p.percent, p.pct, p.percentage, p.progress].find((v) => typeof v === 'number') as number | undefined;
  const message = [p.message, p.stage, p.step, p.status].find((v) => typeof v === 'string') as string | undefined;
  return { percent: raw == null ? undefined : clampPercent(raw), message };
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function isTerminal(status: string): boolean {
  return ['completed', 'dead', 'cancelled'].includes(status);
}

export function isRetryable(status: string): boolean {
  return ['failed', 'dead', 'cancelled'].includes(status);
}

/** tickTime prints a point in time for an axis: the time of day, with the date if it is not today. */
export function tickTime(t: number | string): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}
