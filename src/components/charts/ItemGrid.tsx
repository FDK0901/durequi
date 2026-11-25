import { useNavigate } from 'react-router';
import type { BatchItemState } from '../../api';
import { formatMs } from '../../util';
import { useTip } from './useTip';

const MAX = 2000;
const ORDER = ['failed', 'dead', 'running', 'retrying', 'pending', 'cancelled', 'completed'];

/** One square per item of a batch. */
export function ItemGrid({ items }: { items: BatchItemState[] }) {
  const navigate = useNavigate();
  const { tip, over } = useTip();
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  const statuses = [...counts.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

  return (
    <>
      <div className="item-grid">
        {items.slice(0, MAX).map((i) => (
          <button
            key={i.item_id}
            type="button"
            className={`tone-${i.status}`}
            aria-label={`${i.item_id}: ${i.status}`}
            disabled={!i.job_id}
            onClick={() => navigate(`/jobs/${i.job_id}`)}
            {...over(() => (
              <>
                <strong>{i.item_id}</strong> {i.status}
                {i.started_at && i.finished_at && <div>in {formatMs(new Date(i.finished_at).getTime() - new Date(i.started_at).getTime())}</div>}
                {i.error && <div className="error-text">{i.error}</div>}
              </>
            ))}
          />
        ))}
      </div>
      <div className="chart-legend">
        {statuses.map((s) => <span key={s}><i className={`swatch tone-${s}`} />{s} {counts.get(s)}</span>)}
        {items.length > MAX && <span>First {MAX} of {items.length} items</span>}
      </div>
      {tip}
    </>
  );
}
