import { Center, Loader } from '@mantine/core'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../useAuth'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <Center h="100dvh" aria-busy="true">
        <Loader color="brand" size="md" aria-label="Перевіряємо вхід" />
      </Center>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }} />
  }

  return <Outlet />
}
