import { Navigate } from 'react-router-dom'
import { AccessDenied, usePermissions } from '@/features/auth'
import { useNavigation } from '@/features/navigation'
import { useDefaultDocumentTitle, useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { PageState } from '@/shared/ui/PageState'
import type { ConsoleRoute } from './consoleRoutes'
import { LazyRoute } from './lazyRoute'

export function ConsoleRouteElement({ route }: { route: ConsoleRoute }) {
  const { can, isLoading } = usePermissions()
  const { firstAllowedPath } = useNavigation()
  useDefaultDocumentTitle(route.title)

  if (isLoading) return <PageState kind="loading" />

  if (!can(route.permissionKey) && !route.alsoAllowedBy?.some(can)) {
    if (route.redirectWhenDenied && firstAllowedPath && firstAllowedPath !== route.path) return <Navigate to={firstAllowedPath} replace />
    return <AccessDenied permissionKey={route.permissionKey} homePath={firstAllowedPath ?? '/'} />
  }

  const Page = route.page
  return (
    <LazyRoute>
      <Page />
    </LazyRoute>
  )
}

export function NotFoundRoute() {
  useDocumentTitle('Сторінку не знайдено')
  return <PageState kind="empty" title="Сторінку не знайдено" description="Такої адреси в консолі немає. Оберіть розділ у меню вгорі." />
}
