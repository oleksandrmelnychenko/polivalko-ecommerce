import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageHeaderActionsContext } from './pageHeaderActionsContext'

export function PageHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actionsContainer, setActionsContainer] = useState<HTMLElement | null>(null)
  const [titleContainer, setTitleContainer] = useState<HTMLElement | null>(null)
  const value = useMemo(
    () => ({ actionsContainer, titleContainer, setActionsContainer, setTitleContainer }),
    [actionsContainer, titleContainer],
  )
  return <PageHeaderActionsContext value={value}>{children}</PageHeaderActionsContext>
}

export function PageHeaderActionsSlot({ className }: { className?: string }) {
  const { setActionsContainer } = useContext(PageHeaderActionsContext)
  const ref = useCallback((element: HTMLDivElement | null) => setActionsContainer(element), [setActionsContainer])
  return <div ref={ref} className={className} />
}

export function PageHeaderTitleSlot({ className }: { className?: string }) {
  const { setTitleContainer } = useContext(PageHeaderActionsContext)
  const ref = useCallback((element: HTMLDivElement | null) => setTitleContainer(element), [setTitleContainer])
  return <div ref={ref} className={className} />
}

export function PageHeaderActions({ children }: { children: ReactNode }) {
  const { actionsContainer } = useContext(PageHeaderActionsContext)
  return actionsContainer ? createPortal(children, actionsContainer) : null
}

export function PageHeaderTitle({ children }: { children: ReactNode }) {
  const { titleContainer } = useContext(PageHeaderActionsContext)
  return titleContainer ? createPortal(children, titleContainer) : null
}
