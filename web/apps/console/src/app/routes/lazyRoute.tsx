import { Suspense, type ReactNode } from 'react'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary'
import { PageState } from '@/shared/ui/PageState'

export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<PageState kind="loading" />}>{children}</Suspense>
    </AppErrorBoundary>
  )
}
