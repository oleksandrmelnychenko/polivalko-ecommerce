import { Button } from '@mantine/core'
import { useContext } from 'react'
import { DrawerCloseContext } from './drawerClose'

export function DrawerCancelButton({ disabled, onCancel }: { disabled?: boolean; onCancel: () => void }) {
  const requestClose = useContext(DrawerCloseContext)
  return (
    <Button variant="default" disabled={disabled} onClick={requestClose ?? onCancel}>
      Скасувати
    </Button>
  )
}
