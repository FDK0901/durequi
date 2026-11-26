import { useSyncExternalStore } from 'react';
import { countOtherChanges, otherChanges, type ListKind } from '../context/otherChanges';

const ONE: Record<ListKind, string> = { jobs: 'job', workflows: 'workflow', batches: 'batch' };

/** Offers to read a list again, after what is not in it has changed. */
export function ChangesNote({ kind, since, onRefresh }: { kind: ListKind; since: number; onRefresh: () => void }) {
  useSyncExternalStore(otherChanges.subscribe, otherChanges.get);
  const n = countOtherChanges(kind, since);
  if (n === 0) return null;
  return (
    <p className="hint" role="status">
      {n === 1 ? `1 other ${ONE[kind]}` : `${n.toLocaleString()} other ${kind}`} changed.{' '}
      <button className="btn btn-sm" onClick={onRefresh}>Refresh</button>
    </p>
  );
}
