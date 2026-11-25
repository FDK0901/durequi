import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { WebSocketProvider } from './context/WebsocketProvider'
import { router } from './router'
import './index.css'
import { SettingsProvider } from './context/SettingsProvider'
import { showToast } from './context/toasts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2000,
    },
  },
  // Every action says what came of it. meta.done is the text for success.
  mutationCache: new MutationCache({
    onSuccess: (data, variables, _context, mutation) => {
      const done = mutation.meta?.done;
      if (typeof done === 'string') showToast('done', done);
      else if (typeof done === 'function') showToast('done', done(data, variables));
    },
    onError: (error) => showToast('error', error.message),
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <WebSocketProvider>
          <RouterProvider router={router} />
        </WebSocketProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
)
