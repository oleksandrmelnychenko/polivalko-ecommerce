import { DOCUMENTS_PATH, DocumentOverlayContext, OverlayRouteContext, PARTNERS_PATH } from '@/shared/ui/DocumentLink'
import { matchPath, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage, ProtectedRoute, useAuth } from '@/features/auth'
import { ConsoleLayout } from './layout/ConsoleLayout'
import { PathRedirect, SectionRedirect } from './routes/ConsoleRedirect'
import { ConsoleRouteElement, NotFoundRoute } from './routes/ConsoleRouteElement'
import { consoleRedirects, consoleRoutes, sectionRedirects, type ConsoleRoute } from './routes/consoleRoutes'

export function App() {
  const location = useLocation()
  const { isAuthenticated, hasPermission } = useAuth()
  const overlayMatch = isAuthenticated
    ? consoleRoutes
        .filter(
          (route) =>
            (route.path === DOCUMENTS_PATH + '/:id' || route.path === PARTNERS_PATH + '/:id') &&
            hasPermission(route.permissionKey),
        )
        .map((route) => ({ route, match: matchPath(route.path, location.pathname) }))
        .find((item): item is { route: ConsoleRoute; match: NonNullable<ReturnType<typeof matchPath>> } => Boolean(item.match?.params.id))
    : undefined
  const overlayRoute = overlayMatch?.route
  const overlayId = overlayMatch?.match.params.id
  const background = overlayRoute ? location.state?.documentBackground ?? overlayRoute.path.replace('/:id', '') : location
  return (
    <DocumentOverlayContext.Provider value={Boolean(overlayRoute)}>
      <Routes location={background}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ConsoleLayout overlay={overlayRoute && overlayId ? (
            <OverlayRouteContext.Provider
              value={{
                section: overlayRoute.path === DOCUMENTS_PATH + '/:id' ? 'documents' : 'partners',
                id: overlayId,
                state: location.state,
              }}
            >
              <ConsoleRouteElement route={overlayRoute} />
            </OverlayRouteContext.Provider>
          ) : null} />}>
            {consoleRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={<ConsoleRouteElement route={route} />} />
            ))}
            {consoleRedirects.map((redirect) => (
              <Route key={redirect.from} path={redirect.from} element={<PathRedirect to={redirect.to} />} />
            ))}
            {sectionRedirects.map((prefix) => (
              <Route key={prefix} path={prefix} element={<SectionRedirect prefix={prefix} />} />
            ))}
            <Route path="*" element={<NotFoundRoute />} />
          </Route>
        </Route>
      </Routes>
    </DocumentOverlayContext.Provider>
  )
}
