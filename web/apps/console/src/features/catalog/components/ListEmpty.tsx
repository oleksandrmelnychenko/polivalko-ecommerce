import { Button, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { problemMessage } from '@/shared/api/problem'
import type { ApiQuery } from '@/shared/api/useApiQuery'

export function listEmptyText(query: Pick<ApiQuery<unknown>, 'status' | 'problem' | 'reload'>, fallback: string, empty: ReactNode): ReactNode {
  if (query.status !== 'error' && query.status !== 'forbidden') return empty
  return (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(query.problem, fallback)}</Text>
      {query.status === 'error' ? (
        <Button size="xs" variant="default" onClick={query.reload}>
          Спробувати ще раз
        </Button>
      ) : null}
    </Stack>
  )
}
