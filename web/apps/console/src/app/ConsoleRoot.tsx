import { installApiMiddleware } from '@/shared/api/client'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary'
import { App } from './App'
import { AppProviders } from './providers/AppProviders'

installApiMiddleware()

export function ConsoleRoot() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  )
}
