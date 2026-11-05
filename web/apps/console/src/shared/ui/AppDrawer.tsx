import { Drawer, type DrawerProps } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import './app-drawer.css'

export type AppDrawerProps = Omit<DrawerProps, 'title' | 'size'> & {
  title: ReactNode
  footer?: ReactNode
  size?: 'compact' | 'standard' | 'wide'
}

const SHEET_WIDTHS = {
  compact: 'min(560px, calc(100vw - 16px))',
  standard: 'min(880px, calc(100vw - 16px))',
  wide: 'min(1240px, calc(100vw - 16px))',
} as const

const OUTSIDE_CLOSE_ARM_DELAY_MS = 350

export function AppDrawer({ position = 'right', size = 'compact', children, className, footer, closeButtonProps, ...props }: AppDrawerProps) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setArmed(Boolean(props.opened)), props.opened ? OUTSIDE_CLOSE_ARM_DELAY_MS : 0)
    return () => clearTimeout(timer)
  }, [props.opened])

  return (
    <Drawer
      {...props}
      className={['app-drawer', 'app-form-sheet', className].filter(Boolean).join(' ')}
      closeButtonProps={{ 'aria-label': 'Закрити', ...closeButtonProps }}
      closeOnClickOutside={(props.closeOnClickOutside ?? true) && armed}
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
      <div className="app-sheet-body">
        <div className="app-sheet-scroll">{children}</div>
        {footer ? <div className="app-sheet-footer">{footer}</div> : null}
      </div>
    </Drawer>
  )
}
