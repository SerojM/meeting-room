import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { http, HttpResponse, type RequestHandler } from 'msw'
import { App } from './app/App.tsx'
import { AppProviders } from './app/providers.tsx'
import { worker } from './mocks/browser.ts'
import './index.css'

const E2E_FLAG = 'meeting-room.e2e'

declare global {
  interface Window {
    __bookingMock?: {
      use: (...handlers: RequestHandler[]) => void
      reset: () => void
      http: typeof http
      HttpResponse: typeof HttpResponse
    }
  }
}

async function enableMocking() {
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
  })

  if (localStorage.getItem(E2E_FLAG) === '1') {
    window.__bookingMock = {
      use: (...handlers) => {
        worker.use(...handlers)
      },
      reset: () => {
        worker.resetHandlers()
      },
      http,
      HttpResponse,
    }
  }
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  )
})
