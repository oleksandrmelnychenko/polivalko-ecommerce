import { DocumentOverlayContext } from '@/shared/ui/DocumentLink'
import { matchPath, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage, ProtectedRoute, useAuth } from '@/features/auth'
import { ConsoleLayout } from './layout/ConsoleLayout'
import { PathRedirect, SectionRedirect } from './routes/ConsoleRedirect'
import { ConsoleRouteElement, NotFoundRoute } from './routes/ConsoleRouteElement'
import { consoleRedirects, consoleRoutes, sectionRedirects } from './routes/consoleRoutes'

export function App() {
  const location = useLocation()
  const { isAuthenticated, hasPermission } = useAuth()
  const overlayRoute = isAuthenticated && consoleRoutes.find(route =>
    (route.path === '/accounting/documents/:id' || route.path === '/accounting/partners/:id') &&
    matchPath(route.path, location.pathname) && hasPermission(route.permissionKey))
  const background = overlayRoute ? location.state?.documentBackground ?? overlayRoute.path.replace('/:id', '') : location
  return (
    <DocumentOverlayContext.Provider value={Boolean(overlayRoute)}>
      <Routes location={background}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ConsoleLayout overlay={overlayRoute && (
            <Routes location={location}>
              <Route path={overlayRoute.path} element={<ConsoleRouteElement route={overlayRoute} />} />
            </Routes>
          )} />}>
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
