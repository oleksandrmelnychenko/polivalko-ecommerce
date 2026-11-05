import { Button, Center, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconAlertTriangle, IconLock } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import './page-state.css'

type PageStateProps = {
  kind: 'loading' | 'error' | 'forbidden' | 'empty'
  title?: string
  description?: ReactNode
  action?: ReactNode
  onRetry?: () => void
}

export function PageState({ kind, title, description, action, onRetry }: PageStateProps) {
  if (kind === 'loading') {
    return (
      <Center className="page-state" aria-busy="true">
        <Loader size="sm" color="brand" aria-label="Завантаження" />
      </Center>
    )
  }

  const icon = kind === 'forbidden' ? <IconLock size={22} stroke={1.6} /> : <IconAlertTriangle size={22} stroke={1.6} />
  const color = kind === 'forbidden' ? 'gray' : kind === 'error' ? 'red' : 'gray'
  const heading = title ?? (kind === 'forbidden' ? 'Недостатньо прав' : kind === 'error' ? 'Не вдалося завантажити дані' : 'Даних немає')

  return (
    <Center className="page-state" role={kind === 'error' ? 'alert' : 'status'}>
      <Stack align="center" gap={8} maw={420} ta="center">
        <ThemeIcon variant="light" color={color} size={48} radius="xl">
          {icon}
        </ThemeIcon>
        <Title order={2} size="h4" fw={600}>
          {heading}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
        {onRetry ? (
          <Button variant="default" size="sm" onClick={onRetry}>
            Спробувати ще раз
          </Button>
        ) : null}
        {action}
      </Stack>
    </Center>
  )
}
