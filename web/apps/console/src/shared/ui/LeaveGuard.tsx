import { Button, Text } from '@mantine/core'
import { useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { hasUnsavedChanges, useLeaveGuard } from '../lib/useLeaveGuard'
import { AppModal, AppModalFooter } from './AppModal'

type LeaveGuardProps = {
  when: boolean
  message?: string
}

const defaultMessage = 'Зміни на цій сторінці не збережено. Піти зі сторінки без збереження?'

export function HistoryLeaveGuard() {
  const blocker = useBlocker(({ historyAction, currentLocation, nextLocation }) =>
    historyAction === 'POP' && hasUnsavedChanges() && (
      currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash
    ))
  if (blocker.state !== 'blocked') return null
  return <LeaveDialog opened message={defaultMessage} stay={blocker.reset} leave={blocker.proceed} />
}

export function LeaveGuard({ when, message = defaultMessage }: LeaveGuardProps) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)
  useLeaveGuard(when, setPending)
  if (!when && pending !== null) setPending(null)

  function leave() {
    const to = pending
    setPending(null)
    if (to) navigate(to)
  }

  return <LeaveDialog opened={when && pending !== null} message={message} stay={() => setPending(null)} leave={leave} />
}

function LeaveDialog({ opened, message, stay, leave }: { opened: boolean; message: string; stay: () => void; leave: () => void }) {
  return (
    <AppModal opened={opened} title="Незбережені зміни" size={440} onClose={stay}>
      <Text size="sm">{message}</Text>
      <AppModalFooter>
        <Button variant="default" onClick={stay} data-autofocus>
          Залишитися
        </Button>
        <Button color="red" onClick={leave}>
          Піти без збереження
        </Button>
      </AppModalFooter>
    </AppModal>
  )
}
