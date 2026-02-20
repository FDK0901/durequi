interface PaginationProps {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (offset: number) => void;
}

const MAX_VISIBLE = 5;

function getPageRange(page: number, totalPages: number): number[] {
  if (totalPages <= MAX_VISIBLE) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(MAX_VISIBLE / 2);
  let start = page - half;
  let end = page + half;
  if (start < 1) {
    start = 1;
    end = MAX_VISIBLE;
  }
  if (end > totalPages) {
    end = totalPages;
    start = totalPages - MAX_VISIBLE + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({ offset, limit, total, onOffsetChange }: PaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const pages = getPageRange(page, totalPages);

  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={!hasPrev} onClick={() => onOffsetChange(offset - limit)}>
        Prev
      </button>

      {pages[0] > 1 && (
        <>
          <button className="page-btn" onClick={() => onOffsetChange(0)}>1</button>
          {pages[0] > 2 && <span className="page-ellipsis">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          className={`page-btn${p === page ? ' page-btn-active' : ''}`}
          onClick={() => onOffsetChange((p - 1) * limit)}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="page-ellipsis">...</span>}
          <button className="page-btn" onClick={() => onOffsetChange((totalPages - 1) * limit)}>
            {totalPages}
          </button>
        </>
      )}

      <button className="btn btn-sm" disabled={!hasNext} onClick={() => onOffsetChange(offset + limit)}>
        Next
      </button>

      <span className="pagination-info">({total} total)</span>
    </div>
  );
}

interface SortSelectProps {
  value: 'newest' | 'oldest';
  onChange: (v: 'newest' | 'oldest') => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as 'newest' | 'oldest')}>
      <option value="newest">Newest</option>
      <option value="oldest">Oldest</option>
    </select>
  );
}
