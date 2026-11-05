import { useCallback, useState } from 'react'

type Editing<T> = { item: T | null; key: number }

export function useEditorDrawer<T>() {
  const [editing, setEditing] = useState<Editing<T> | null>(null)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const open = useCallback((item: T | null) => {
    setActionError(null)
    setEditing({ item, key: Date.now() })
    setOpened(true)
  }, [])

  const close = useCallback(() => {
    if (!busy) setOpened(false)
  }, [busy])

  return {
    editing,
    current: editing?.item ?? null,
    opened,
    setOpened,
    busy,
    setBusy,
    confirming,
    setConfirming,
    actionError,
    setActionError,
    open,
    close,
  }
}
