import { Route, Routes } from 'react-router-dom'
import { LoginPage, ProtectedRoute } from '@/features/auth'
import { ConsoleLayout } from './layout/ConsoleLayout'
import { PathRedirect, SectionRedirect } from './routes/ConsoleRedirect'
import { ConsoleRouteElement, NotFoundRoute } from './routes/ConsoleRouteElement'
import { consoleRedirects, consoleRoutes, sectionRedirects } from './routes/consoleRoutes'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<ConsoleLayout />}>
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
  )
}
