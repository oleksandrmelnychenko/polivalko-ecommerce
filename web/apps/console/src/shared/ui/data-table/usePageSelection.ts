import { useCallback, useMemo, useState } from 'react'

const EMPTY: ReadonlySet<string> = new Set()

type Stored = { scope: string; ids: ReadonlySet<string> }

export function usePageSelection(scope: string, pageIds: readonly string[]) {
  const [stored, setStored] = useState<Stored>({ scope, ids: EMPTY })
  const kept = stored.scope === scope ? stored.ids : EMPTY
  const selected = useMemo(() => {
    if (kept.size === 0) return kept
    const onPage = new Set(pageIds)
    const visible = [...kept].filter((id) => onPage.has(id))
    return visible.length === kept.size ? kept : new Set(visible)
  }, [kept, pageIds])

  if (stored.scope === scope && selected !== stored.ids) setStored({ scope, ids: selected })

  const select = useCallback((ids: ReadonlySet<string>) => setStored({ scope, ids }), [scope])
  const clear = useCallback(() => setStored({ scope, ids: EMPTY }), [scope])

  return { selected, select, clear }
}
