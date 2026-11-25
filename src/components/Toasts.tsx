import { useSyncExternalStore } from 'react';
import { dismissToast, toastStore } from '../context/toasts';

export function Toasts() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.text}</span>
          <button className="task-sidebar-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">&times;</button>
        </div>
      ))}
    </div>
  );
}
