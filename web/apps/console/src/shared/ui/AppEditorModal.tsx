import { Button, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { AppModal, AppModalFooter, type AppModalProps } from './AppModal'
import { DrawerCloseContext } from './drawerClose'
import './editor-modal.css'

export type AppEditorModalProps = Omit<AppModalProps, 'size'> & {
  footer?: ReactNode
  size?: 'compact' | 'standard' | 'wide'
  dirty?: boolean
}

const MODAL_WIDTHS = {
  compact: 'min(560px, calc(100vw - 16px))',
  standard: 'min(880px, calc(100vw - 16px))',
  wide: 'min(1240px, calc(100vw - 16px))',
} as const

const OUTSIDE_CLOSE_ARM_DELAY_MS = 350
const editorTransition = {
  in: { opacity: 1, transform: 'scale(1)' },
  out: { opacity: 0, transform: 'scale(.97)' },
  common: { transformOrigin: 'center' },
  transitionProperty: 'opacity, transform',
}

export function AppEditorModal({ size = 'compact', children, className, footer, dirty = false, onClose, ...props }: AppEditorModalProps) {
  const reducedMotion = useReducedMotion()
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
      <AppModal
        {...props}
        onClose={requestClose}
        className={['app-editor-modal', className].filter(Boolean).join(' ')}
        closeOnEscape={(props.closeOnEscape ?? true) && !confirming}
        closeOnClickOutside={(props.closeOnClickOutside ?? true) && armed && !confirming}
        size={MODAL_WIDTHS[size]}
        xOffset={8}
        yOffset={12}
        transitionProps={{ transition: editorTransition, duration: reducedMotion ? 0 : 180, exitDuration: reducedMotion ? 0 : 140, timingFunction: 'ease-out' }}
      >
        <DrawerCloseContext.Provider value={requestClose}>
          <div className="app-sheet-body">
            <div className="app-sheet-scroll">{children}</div>
            {footer ? <div className="app-sheet-footer">{footer}</div> : null}
          </div>
        </DrawerCloseContext.Provider>
      </AppModal>
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
