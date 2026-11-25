import { shortId } from '../util';
import { showToast } from '../context/toasts';

/** An ID, shortened, with a button to copy all of it. */
export function CopyId({ id, length }: { id: string; length?: number }) {
  return (
    <span className="mono id-cell">
      <span title={id}>{shortId(id, length)}</span>
      <button
        className="btn-copy"
        aria-label={`Copy ID ${id}`}
        title="Copy ID"
        onClick={(e) => {
          e.stopPropagation();
          // Not available on a page served over plain HTTP.
          navigator.clipboard
            ?.writeText(id)
            .then(() => showToast('done', 'ID copied'), () => showToast('error', 'Could not copy the ID'));
        }}
      />
    </span>
  );
}
