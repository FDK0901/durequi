import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsURL } from '../base';
import type { JobEvent } from '../api';
import { createEventHandler } from './applyEvents';
import { WebsocketContext } from './WebsocketContext';
import { addEvents } from './eventLog';
import { createRefresher } from './refresh';
import { useSettings } from './useSettings';

const FLUSH_MS = 1000;
/** More events than this in one go are not looked at one by one. */
const MAX_PENDING = 2000;

const RESYNC = 'ws.resync';

function asEvent(data: unknown): JobEvent | null {
  return typeof (data as JobEvent | null)?.type === 'string' ? (data as JobEvent) : null;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { wsEnabled, refreshInterval } = useSettings();
  const refresher = useMemo(() => createRefresher(queryClient), [queryClient]);
  const apply = useMemo(() => createEventHandler(queryClient, refresher), [queryClient, refresher]);
  const pending = useRef<JobEvent[]>([]);
  const missed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollOff = useRef(false);
  const pollMs = useRef(0);
  useEffect(() => {
    pollOff.current = !refreshInterval;
    pollMs.current = refreshInterval;
  }, [refreshInterval]);

  // A busy cluster sends many events a second. They are collected for a moment.
  const flush = useCallback(() => {
    timer.current = null;
    const events = pending.current;
    pending.current = [];
    addEvents(events);
    if (missed.current) {
      missed.current = false;
      // As often as that may come, it costs no more than polling.
      refresher.markAll({ floor: pollMs.current });
      return;
    }
    apply(events, pollOff.current);
  }, [apply, refresher]);

  const onMessage = useCallback(
    (data: unknown) => {
      const event = asEvent(data);
      if (!event) return; // Not an event — ignore.
      if (event.type === RESYNC) {
        missed.current = true;
      } else {
        pending.current.push(event);
        if (pending.current.length > MAX_PENDING) {
          pending.current.splice(0, pending.current.length - MAX_PENDING / 2);
          missed.current = true;
        }
      }
      timer.current ??= setTimeout(flush, FLUSH_MS);
    },
    [flush],
  );

  // What has happened while there was no connection is not announced any more. It is read
  // right away, however recently it was read before.
  const onOpen = useCallback(() => refresher.markAll({ now: true }), [refresher]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      refresher.stop();
    },
    [refresher],
  );

  const { status } = useWebSocket({ url: wsURL(), onMessage, onOpen, enabled: wsEnabled });

  return (
    <WebsocketContext.Provider value={{ status }}>
      {children}
    </WebsocketContext.Provider>
  );
}
