import { useCallback, useState, type ReactNode } from 'react'
import { AppModal } from '@/shared/ui/AppModal'

export type Detail = { title: ReactNode; body: ReactNode }

export type ShowDetail = (detail: Detail) => void

export function useDetailModal() {
  const [state, setState] = useState<{ detail: Detail | null; opened: boolean }>({ detail: null, opened: false })
  const show = useCallback<ShowDetail>((detail) => setState({ detail, opened: true }), [])
  const close = useCallback(() => setState((current) => ({ ...current, opened: false })), [])
  const modal = (
    <AppModal opened={state.opened} title={state.detail?.title ?? ''} size={640} onClose={close}>
      <div className="integration-detail">{state.detail?.body}</div>
    </AppModal>
  )
  return { show, modal }
}
