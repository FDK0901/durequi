// A short-lived message about an action, kept outside of React so that the query
// client can report what came of a mutation.

export interface Toast {
  id: number;
  kind: 'done' | 'error';
  text: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: Toast[]) {
  toasts = next;
  listeners.forEach((l) => l());
}

export function showToast(kind: Toast['kind'], text: string) {
  const toast = { id: nextId++, kind, text };
  set([...toasts, toast].slice(-4));
  setTimeout(() => dismissToast(toast.id), kind === 'error' ? 10_000 : 4000);
}

export function dismissToast(id: number) {
  set(toasts.filter((t) => t.id !== id));
}

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => toasts,
};
