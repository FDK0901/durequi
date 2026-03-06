import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket, type WsStatus } from '../hooks/useWebSocket';
import { useSettings } from './SettingsContext';
import type { JobEvent } from '../api';

interface WebSocketContextValue {
  status: WsStatus;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  status: 'disconnected',
});

function getInvalidationKeys(eventType: string): string[][] {
  const keys: string[][] = [];

  if (eventType.startsWith('job.')) {
    keys.push(['jobs'], ['stats'], ['dailyStats'], ['historyRuns'], ['historyEvents']);
  }
  if (eventType.startsWith('workflow.')) {
    keys.push(['workflows'], ['stats']);
  }
  if (eventType.startsWith('batch.')) {
    keys.push(['batches'], ['stats']);
  }
  if (eventType.startsWith('node.')) {
    keys.push(['nodes'], ['stats']);
  }
  if (eventType.startsWith('schedule.')) {
    keys.push(['schedules'], ['jobs'], ['stats']);
  }
  if (eventType.startsWith('leader.')) {
    keys.push(['stats']);
  }

  return keys;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { wsEnabled } = useSettings();

  const onMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const jobEvent: JobEvent = JSON.parse(event.data);

        const keys = getInvalidationKeys(jobEvent.type);
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }

        if (jobEvent.job_id) {
          queryClient.invalidateQueries({ queryKey: ['job', jobEvent.job_id] });
          queryClient.invalidateQueries({
            queryKey: ['jobRuns', jobEvent.job_id],
          });
          queryClient.invalidateQueries({
            queryKey: ['jobEvents', jobEvent.job_id],
          });
        }
      } catch {
        // Malformed message — ignore.
      }
    },
    [queryClient],
  );

  const { status } = useWebSocket({ onMessage, enabled: wsEnabled });

  return (
    <WebSocketContext.Provider value={{ status }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketStatus() {
  return useContext(WebSocketContext);
}
