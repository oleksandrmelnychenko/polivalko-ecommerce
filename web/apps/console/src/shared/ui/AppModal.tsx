import { Modal, type ModalProps } from '@mantine/core'
import type { PropsWithChildren, ReactNode } from 'react'
import './app-modal.css'

const DEFAULT_MODAL_SIZE = 496

export type AppModalProps = Omit<ModalProps, 'title'> & {
  title: ReactNode
}

export function AppModalFooter({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={['app-modal-footer', className].filter(Boolean).join(' ')}>{children}</div>
}

export function AppModal({ centered, children, className, size, closeButtonProps, ...props }: AppModalProps) {
  return (
    <Modal
      {...props}
      centered={centered ?? true}
      className={['app-modal', 'app-form-sheet', className].filter(Boolean).join(' ')}
      closeButtonProps={{ 'aria-label': 'Закрити', ...closeButtonProps }}
      size={size ?? DEFAULT_MODAL_SIZE}
    >
      {children}
    </Modal>
  )
}
