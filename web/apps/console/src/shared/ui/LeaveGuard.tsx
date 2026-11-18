import { Button, Text } from '@mantine/core'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLeaveGuard } from '../lib/useLeaveGuard'
import { AppModal, AppModalFooter } from './AppModal'

type LeaveGuardProps = {
  when: boolean
  message?: string
}

export function LeaveGuard({ when, message = 'Зміни на цій сторінці не збережено. Піти зі сторінки без збереження?' }: LeaveGuardProps) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)
  useLeaveGuard(when, setPending)
  if (!when && pending !== null) setPending(null)

  function leave() {
    const to = pending
    setPending(null)
    if (to) navigate(to)
  }

  return (
    <AppModal opened={when && pending !== null} title="Незбережені зміни" size={440} onClose={() => setPending(null)}>
      <Text size="sm">{message}</Text>
      <AppModalFooter>
        <Button variant="default" onClick={() => setPending(null)} data-autofocus>
          Залишитися
        </Button>
        <Button color="red" onClick={leave}>
          Піти без збереження
        </Button>
      </AppModalFooter>
    </AppModal>
  )
}
