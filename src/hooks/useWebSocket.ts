import { useEffect, useRef, useState } from 'react';

/** late: open, but what comes is late (see createLateness). */
export type WsStatus = 'connecting' | 'connected' | 'late' | 'disconnected' | 'offline';

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
const RESYNC = 'ws.resync';
/** When the server wrote a heartbeat or a resync, in milliseconds since 1970 by its clock (dureq v0.3.3). */
const BEAT_SENT = 'server_time_ms';
/** What comes this much later than it would on time is late: a heartbeat period. */
const LATE_MS = 15_000;
/** Of a source, so many have to have come before they tell how late the next ones are. */
const SETTLE = 3;
/** The quickest is that of this and the last window, so that a clock that is set back is got over. */
const WINDOW_MS = 5 * 60_000;
const MAX_SOURCES = 64;

/**
 * When a frame was written, and by whose clock: a heartbeat or a resync by the server's
 * (server_time_ms), an event by that of the node that published it (timestamp). Events
 * without node_id are taken to be of one source.
 */
function writtenAt(frame: unknown, type: unknown): { source: string; at: number } | undefined {
  const f = frame as Record<string, unknown>;
  if (type === HEARTBEAT || type === RESYNC) {
    const v = f[BEAT_SENT];
    return typeof v === 'number' && Number.isFinite(v) ? { source: '', at: v } : undefined;
  }
  const at = typeof f.timestamp === 'string' ? Date.parse(f.timestamp) : NaN;
  if (!Number.isFinite(at)) return undefined;
  return { source: `node ${typeof f.node_id === 'string' ? f.node_id : ''}`, at };
}

/**
 * How late frames come, from when they were written. The clocks of server, nodes and browser
 * need not agree: what counts is how much later than the quickest of the same source on this
 * connection, which is about the difference of the clocks. undefined until a source has
 * settled.
 */
function createLateness() {
  const sources = new Map<string, { quickest: number; before: number; since: number; seen: number }>();
  return (source: string, at: number): number | undefined => {
    const now = Date.now();
    const took = now - at;
    let s = sources.get(source);
    if (!s) {
      if (sources.size >= MAX_SOURCES) return undefined;
      s = { quickest: Infinity, before: Infinity, since: now, seen: 0 };
      sources.set(source, s);
    }
    if (now - s.since > WINDOW_MS) {
      s.before = s.quickest;
      s.quickest = Infinity;
      s.since = now;
    }
    s.quickest = Math.min(s.quickest, took);
    if (++s.seen < SETTLE) return undefined;
    return took - Math.min(s.quickest, s.before);
  };
}

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
    // How late what comes over it is; the last frame that tells says whether it is late.
    let lateness = createLateness();
    let late = false;

    function time(data: unknown, type: unknown) {
      const written = writtenAt(data, type);
      const lag = written && lateness(written.source, written.at);
      if (lag === undefined || late === lag > LATE_MS) return;
      late = !late;
      setStatus(late ? 'late' : 'connected');
    }

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
      lateness = createLateness();
      late = false;
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
        const type = (data as { type?: unknown } | null)?.type;
        const beat = type === HEARTBEAT;
        beats ||= beat;
        listen();
        time(data, type);
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
