import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import type { JobEvent } from '../api';
import { WebsocketContext } from './WebsocketContext';
import { addEvents } from './eventLog';
import { useSettings } from './useSettings';

const FLUSH_MS = 1000;

function getInvalidationKeys(event: JobEvent): string[][] {
  const keys: string[][] = [];
  const type = event.type;

  if (type.startsWith('job.')) {
    keys.push(['jobs'], ['stats'], ['dailyStats'], ['historyRuns'], ['activeRuns']);
  }
  if (type.startsWith('workflow.')) {
    keys.push(['workflows'], ['stats']);
  }
  if (type.startsWith('batch.')) {
    keys.push(['batches'], ['stats']);
  }
  if (type.startsWith('node.')) {
    keys.push(['nodes'], ['activeRuns'], ['stats']);
  }
  if (type.startsWith('schedule.')) {
    keys.push(['schedules'], ['jobs'], ['stats']);
  }
  if (type.startsWith('leader.')) {
    keys.push(['stats']);
  }
  if (type === 'job.failed' || type === 'job.dead') {
    keys.push(['dlq']);
  }
  if (type === 'job.paused' || type === 'job.resumed' || type === 'job.cancelled') {
    keys.push(['schedules'], ['uniqueKey']);
  }

  if (event.workflow_id) {
    keys.push(['workflow', event.workflow_id], ['workflowAudit', event.workflow_id]);
  }
  if (event.job_id) {
    if (type.startsWith('batch.')) {
      keys.push(['batch', event.job_id], ['batchResults', event.job_id]);
    } else if (type.startsWith('workflow.')) {
      keys.push(['workflow', event.job_id], ['workflowAudit', event.job_id]);
    } else {
      keys.push(['job', event.job_id], ['jobRuns', event.job_id], ['jobAudit', event.job_id]);
    }
  }
  return keys;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { wsEnabled } = useSettings();
  const pending = useRef<JobEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A busy cluster sends many events a second. They are collected, and each query is
  // invalidated once per flush.
  const flush = useCallback(() => {
    timer.current = null;
    const events = pending.current;
    pending.current = [];
    const keys = new Map<string, string[]>();
    for (const event of events) {
      for (const key of getInvalidationKeys(event)) keys.set(key.join('\0'), key);
    }
    for (const queryKey of keys.values()) queryClient.invalidateQueries({ queryKey });
    addEvents(events);
  }, [queryClient]);

  const onMessage = useCallback(
    (message: MessageEvent) => {
      try {
        pending.current.push(JSON.parse(message.data));
      } catch {
        return; // Malformed message — ignore.
      }
      timer.current ??= setTimeout(flush, FLUSH_MS);
    },
    [flush],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const { status } = useWebSocket({ onMessage, enabled: wsEnabled });

  return (
    <WebsocketContext.Provider value={{ status }}>
      {children}
    </WebsocketContext.Provider>
  );
}
