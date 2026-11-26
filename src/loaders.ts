import { api, ApiError, type Job, type JobRun } from './api';

// Rows of a list that ask for what they need one by one share a request. Servers before that
// had one request each.

const WAIT_MS = 10;
const MAX_IDS = 100;

// Both requests for many came with the same version.
let supported = true;

/** Whether it takes one request to read many. Not known before it has been tried. */
export const readsManyAtOnce = () => supported;

/** 403: a proxy that lets no POST through. */
function isUnsupported(e: unknown): boolean {
  return e instanceof ApiError && [403, 404, 405, 501].includes(e.status);
}

interface Waiting<T> {
  id: string;
  resolve: (value: T | undefined) => void;
  reject: (error: unknown) => void;
}

/** Collects calls for a moment, and loads what they ask for together. */
function batched<T>(many: (ids: string[]) => Promise<Map<string, T>>, one: (id: string) => Promise<T | undefined>) {
  let waiting: Waiting<T>[] = [];

  async function load(calls: Waiting<T>[]) {
    const ids = [...new Set(calls.map((c) => c.id))];
    if (supported && ids.length > 1) {
      try {
        const found = await many(ids);
        calls.forEach((c) => c.resolve(found.get(c.id)));
        return;
      } catch (e) {
        if (!isUnsupported(e)) {
          calls.forEach((c) => c.reject(e));
          return;
        }
        supported = false;
      }
    }
    const results = new Map(ids.map((id) => [id, one(id)]));
    calls.forEach((c) => results.get(c.id)!.then(c.resolve, c.reject));
  }

  return (id: string) =>
    new Promise<T | undefined>((resolve, reject) => {
      if (waiting.length === 0) {
        setTimeout(() => {
          const calls = waiting;
          waiting = [];
          for (let i = 0; i < calls.length; i += MAX_IDS) void load(calls.slice(i, i + MAX_IDS));
        }, WAIT_MS);
      }
      waiting.push({ id, resolve, reject });
    });
}

const jobByID = batched<Job>(
  async (ids) => new Map((await api.getJobsByIDs(ids)).map((job) => [job.id, job])),
  (id) => api.getJob(id),
);

export async function loadJob(id: string): Promise<Job> {
  const job = await jobByID(id);
  if (!job) throw new ApiError(404, 'job not found');
  return job;
}

/** The jobs of these IDs that exist. */
export async function loadJobs(ids: string[]): Promise<Map<string, Job>> {
  const jobs = new Map<string, Job>();
  await Promise.all(
    ids.map((id) =>
      loadJob(id).then(
        (job) => jobs.set(id, job),
        (e) => {
          if (!(e instanceof ApiError) || e.status !== 404) throw e;
        },
      ),
    ),
  );
  return jobs;
}

const runsByLimit = new Map<number, (id: string) => Promise<JobRun[] | undefined>>();

/** The last runs of a job, newest first. */
export async function loadJobRuns(jobId: string, limit: number): Promise<JobRun[]> {
  let load = runsByLimit.get(limit);
  if (!load) {
    load = batched<JobRun[]>(
      async (ids) => new Map(Object.entries(await api.listRunsOfJobs(ids, limit))),
      async (id) => (await api.listJobRuns(id, limit)) ?? [],
    );
    runsByLimit.set(limit, load);
  }
  return (await load(jobId)) ?? [];
}
