import { useEffect, useRef, useState } from 'react';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

interface UseWebSocketOptions {
  url: string;
  enabled: boolean;
  onMessage: (data: unknown) => void;
  /** Called with every connection, also the first one. */
  onOpen?: () => void;
  /**
   * Called when the network has gone or changed, or the connection has died without being
   * closed: what is on its way over HTTP may never come either.
   */
  onLost?: () => void;
}

const MAX_DELAY_MS = 30_000;
/** A connection that lasts shorter than this counts as failed, for the delay of the next one. */
const LASTING_MS = 10_000;
/** A server that sends heartbeats does so every 15 seconds. */
const SILENCE_MS = 35_000;
/** When the network changes, a socket not heard of for longer than a heartbeat takes is replaced. */
const SUSPECT_MS = 17_000;

const HEARTBEAT = 'ws.heartbeat';

/** A WebSocket that is opened again when it closes, or when a server that sends heartbeats stops to. */
export function useWebSocket({ url, enabled, onMessage, onOpen, onLost }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const handlers = useRef({ onMessage, onOpen, onLost });
  useEffect(() => {
    handlers.current = { onMessage, onOpen, onLost };
  });

  useEffect(() => {
    if (!enabled) return;
    // All of this belongs to this run of the effect. A socket that has been replaced has no
    // say any more, however late it closes.
    let current: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let silence: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let openedAt = 0;
    // Of the current socket: when it was heard of last, and whether its server sends heartbeats.
    let heardAt = 0;
    let beats = false;

    function drop(ws: WebSocket) {
      if (current !== ws) return;
      current = null;
      clearTimeout(silence);
      if (openedAt && Date.now() - openedAt > LASTING_MS) attempt = 0;
      openedAt = 0;
      // Without a network it is opened again when there is one.
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }
      setStatus('disconnected');
      // Not all tabs at once.
      const delay = Math.min(1000 * 2 ** attempt++, MAX_DELAY_MS) * (0.5 + Math.random() / 2);
      retry = setTimeout(connect, delay);
    }

    function connect() {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        // Such as an http API for an https page. That does not change by trying again: what
        // events would announce is polled instead.
        console.error('The WebSocket cannot be opened:', e);
        setStatus('disconnected');
        return;
      }
      setStatus('connecting');
      current = ws;
      beats = false;
      const listen = () => {
        heardAt = Date.now();
        clearTimeout(silence);
        if (beats) {
          silence = setTimeout(() => {
            drop(ws);
            ws.close();
            handlers.current.onLost?.();
          }, SILENCE_MS);
        }
      };
      ws.onopen = () => {
        if (current !== ws) return;
        openedAt = heardAt = Date.now();
        setStatus('connected');
        handlers.current.onOpen?.();
      };
      ws.onmessage = (e) => {
        if (current !== ws) return;
        let data: unknown;
        try {
          data = JSON.parse(String(e.data));
        } catch {
          return;
        }
        const beat = (data as { type?: unknown } | null)?.type === HEARTBEAT;
        beats ||= beat;
        listen();
        if (!beat) handlers.current.onMessage(data);
      };
      ws.onclose = () => drop(ws);
    }

    function wake() {
      if (document.visibilityState !== 'visible' || current || !navigator.onLine) return;
      clearTimeout(retry);
      attempt = 0;
      connect();
    }

    // Nothing comes without a network, though the socket may not say so for long.
    function offline() {
      clearTimeout(retry);
      const ws = current;
      if (ws) {
        drop(ws);
        ws.close();
      }
      setStatus('offline');
      handlers.current.onLost?.();
    }

    // The network has changed. A socket from before is kept only if it has been heard of
    // lately; one from a server without heartbeats cannot tell.
    function online() {
      clearTimeout(retry);
      attempt = 0;
      const ws = current;
      if (ws && beats && Date.now() - heardAt <= SUSPECT_MS) return;
      if (ws) {
        current = null;
        clearTimeout(silence);
        openedAt = 0;
        ws.close();
      }
      connect();
      handlers.current.onLost?.();
    }

    if (navigator.onLine) connect();
    else offline();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', wake);
      clearTimeout(retry);
      clearTimeout(silence);
      const ws = current;
      current = null; // before it closes
      ws?.close(1000);
    };
  }, [url, enabled]);

  return { status: enabled ? status : 'disconnected' as WsStatus };
}
