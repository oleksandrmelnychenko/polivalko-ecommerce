import { Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { Failure } from '../lib/problems'

export function FailureAlert({ failure, extra, children }: { failure: Failure | null; extra?: string[]; children?: ReactNode }) {
  if (!failure?.title) return null
  const lines = [failure.detail, ...(extra ?? [])].filter((line): line is string => Boolean(line))
  if (lines.length === 0 && !children) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
        {failure.title}
      </Alert>
    )
  }
  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={failure.title} role="alert">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      {children}
    </Alert>
  )
}
