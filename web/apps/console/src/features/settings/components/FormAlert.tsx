import { Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

export function FormAlert({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
      {error}
    </Alert>
  )
}
