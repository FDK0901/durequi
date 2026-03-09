import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { WebSocketProvider } from './context/WebsocketProvider'
import { router } from './router'
import './index.css'
import { SettingsProvider } from './context/SettingsProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2000,
    },
  },
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
