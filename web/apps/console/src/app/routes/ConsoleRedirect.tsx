import { Navigate, useLocation, useParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { sectionByPrefix, useNavigation } from '@/features/navigation'
import { PageState } from '@/shared/ui/PageState'
import { NotFoundRoute } from './ConsoleRouteElement'
import { redirectTarget } from './consoleRoutes'

export function PathRedirect({ to }: { to: string }) {
  const params = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={redirectTarget(to, params, search, hash)} replace />
}

export function SectionRedirect({ prefix }: { prefix: string }) {
  const { isLoading } = usePermissions()
  const { sections } = useNavigation()
  const { search, hash } = useLocation()

  if (isLoading) return <PageState kind="loading" />

  const target = sectionByPrefix(sections, prefix)?.items[0]?.path
  if (!target) return <NotFoundRoute />
  return <Navigate to={redirectTarget(target, {}, search, hash)} replace />
}
