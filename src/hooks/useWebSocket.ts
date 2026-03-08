import { useEffect, useRef, useCallback, useState } from 'react';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketOptions {
  onMessage: (event: MessageEvent) => void;
  enabled: boolean;
}

export function useWebSocket({ onMessage, enabled }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabledRef.current) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    )
      return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/ws`;

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      attemptRef.current = 0;
    };

    ws.onmessage = (e) => onMessageRef.current(e);

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      if (enabledRef.current) {
        const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 30000);
        attemptRef.current++;
        // eslint-disable-next-line react-hooks/immutability
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror, which handles reconnection.
    };
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close(1000, 'disabled by user');
        wsRef.current = null;
      }
      setStatus('disconnected');
      attemptRef.current = 0;
    }

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'component unmount');
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  return { status };
}
