import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useHistoryEvents } from '../hooks';
import { EventTable } from '../components/EventTable';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 50;

export default function Events() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id') ?? '';
  const [draft, setDraft] = useState(id);
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error, isFetching, refetch } = useHistoryEvents({ limit: PAGE_SIZE, offset, job_id: id || undefined });

  function filterBy(value: string) {
    setDraft(value);
    setParams(value ? { id: value } : {}, { replace: true });
    setOffset(0);
  }

  const events = data?.data ?? [];

  return (
    <div className="page">
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          filterBy(draft.trim());
        }}
      >
        <h2>Events</h2>
        <input
          type="text"
          placeholder="ID of a job, workflow or batch..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn" type="submit">Filter</button>
        {id && <button className="btn" type="button" onClick={() => filterBy('')}>All Events</button>}
        <button className="btn" type="button" onClick={() => refetch()} disabled={isFetching}>Refresh</button>
      </form>
      <p className="hint">
        The last events the cluster has kept, about 50,000 by default. The list stays as it is until you refresh it.
        The events of a workflow's tasks are under the IDs of their jobs.
      </p>

      {isLoading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {data && events.length === 0 && (
        <div className="empty-state">{id ? 'No events of this ID, or not any more.' : 'No events yet.'}</div>
      )}
      {events.length > 0 && (
        <>
          <EventTable events={events} />
          <Pagination offset={offset} limit={PAGE_SIZE} total={data?.total ?? 0} onOffsetChange={setOffset} />
        </>
      )}
    </div>
  );
}
