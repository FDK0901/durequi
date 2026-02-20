import { useState } from 'react';
import { useDLQ } from '../hooks';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 10;

export default function DLQ() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useDLQ({
    limit: PAGE_SIZE,
    offset,
  });

  const messages = data?.data ?? [];
  const total = data?.total ?? 0;

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <h2>Dead Letter Queue</h2>

      {messages.length === 0 && (
        <div className="empty-state">DLQ is empty</div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className="dlq-item">
          <pre>{JSON.stringify(msg, null, 2)}</pre>
        </div>
      ))}

      <Pagination offset={offset} limit={PAGE_SIZE} total={total} onOffsetChange={setOffset} />
    </div>
  );
}
