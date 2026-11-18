import { Button, Drawer, Text, type DrawerProps } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { AppModal, AppModalFooter } from './AppModal'
import { DrawerCloseContext } from './drawerClose'
import './app-drawer.css'

export type AppDrawerProps = Omit<DrawerProps, 'title' | 'size'> & {
  title: ReactNode
  footer?: ReactNode
  size?: 'compact' | 'standard' | 'wide'
  dirty?: boolean
}

const SHEET_WIDTHS = {
  compact: 'min(560px, calc(100vw - 16px))',
  standard: 'min(880px, calc(100vw - 16px))',
  wide: 'min(1240px, calc(100vw - 16px))',
} as const

const OUTSIDE_CLOSE_ARM_DELAY_MS = 350

export function AppDrawer({ position = 'right', size = 'compact', children, className, footer, closeButtonProps, dirty = false, onClose, ...props }: AppDrawerProps) {
  const [armed, setArmed] = useState(false)
  const [asking, setAsking] = useState(false)
  const confirming = asking && Boolean(props.opened) && dirty

  if (asking && !props.opened) setAsking(false)

  useEffect(() => {
    const timer = setTimeout(() => setArmed(Boolean(props.opened)), props.opened ? OUTSIDE_CLOSE_ARM_DELAY_MS : 0)
    return () => clearTimeout(timer)
  }, [props.opened])

  function requestClose() {
    if (dirty) {
      setAsking(true)
      return
    }
    onClose()
  }

  function discard() {
    setAsking(false)
    onClose()
  }

  return (
    <>
      <Drawer
        {...props}
        onClose={requestClose}
        className={['app-drawer', 'app-form-sheet', className].filter(Boolean).join(' ')}
        closeButtonProps={{ 'aria-label': 'Закрити', ...closeButtonProps }}
        closeOnEscape={(props.closeOnEscape ?? true) && !confirming}
        closeOnClickOutside={(props.closeOnClickOutside ?? true) && armed && !confirming}
        position={position}
        size={SHEET_WIDTHS[size]}
        styles={{
          content: {
            margin: 8,
            height: 'calc(100% - 16px)',
            maxWidth: 'calc(100vw - 16px)',
            borderRadius: 14,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
          header: { minHeight: 52, padding: '10px 16px', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid var(--mantine-color-gray-2)' },
          body: { display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, overflow: 'hidden', padding: 0 },
        }}
      >
        <DrawerCloseContext.Provider value={requestClose}>
          <div className="app-sheet-body">
            <div className="app-sheet-scroll">{children}</div>
            {footer ? <div className="app-sheet-footer">{footer}</div> : null}
          </div>
        </DrawerCloseContext.Provider>
      </Drawer>
      <AppModal opened={confirming} title="Незбережені зміни" size={440} onClose={() => setAsking(false)}>
        <Text size="sm">Зміни в цій формі не збережено. Закрити її без збереження?</Text>
        <AppModalFooter>
          <Button variant="default" onClick={() => setAsking(false)} data-autofocus>
            Залишитися
          </Button>
          <Button color="red" onClick={discard}>
            Закрити без збереження
          </Button>
        </AppModalFooter>
      </AppModal>
    </>
  )
}
