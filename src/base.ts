/** Where the API is: nothing for the host the page is from, or e.g. "https://dureq.example.com". */
const BASE = (import.meta.env.VITE_DUREQ_API_BASE ?? '').replace(/\/+$/, '');

export const apiURL = (path: string) => BASE + path;

/** ?v=2 asks for heartbeats and for being told of missed events. Older servers ignore it. */
export function wsURL(): string {
  const url = new URL(apiURL('/api/ws?v=2'), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
