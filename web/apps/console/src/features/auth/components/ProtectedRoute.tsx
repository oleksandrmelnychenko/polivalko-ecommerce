import { Center, Loader, Stack, Text } from '@mantine/core'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../useAuth'

export function ProtectedRoute() {
  const { status, reconnecting } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <Center h="100dvh" aria-busy="true">
        <Stack align="center" gap="sm">
          <Loader color="brand" size="md" aria-label="Перевіряємо вхід" />
          {reconnecting ? (
            <Text size="sm" c="dimmed" role="status">
              Сервер не відповідає. Пробуємо з&apos;єднатися ще раз…
            </Text>
          ) : null}
        </Stack>
      </Center>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }} />
  }

  return <Outlet />
}
