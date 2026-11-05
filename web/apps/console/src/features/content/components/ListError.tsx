import { Button, Stack, Text } from '@mantine/core'
import { problemMessage } from '@/shared/api/problem'

const LOAD_FAILED = 'Не вдалося завантажити дані. Перевірте, що API працює, і спробуйте ще раз.'

type ListErrorProps = {
  problem: unknown
  fallback?: string
  onRetry: () => void
}

export function ListError({ problem, fallback = LOAD_FAILED, onRetry }: ListErrorProps) {
  return (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(problem, fallback)}</Text>
      <Button size="xs" variant="default" onClick={onRetry}>
        Спробувати ще раз
      </Button>
    </Stack>
  )
}
