import { IconList, IconNumber123, IconToggleRight } from '@tabler/icons-react'
import type { AttributeKind } from '../api/dictionariesApi'

const KIND_ICONS = { list: IconList, number: IconNumber123, boolean: IconToggleRight } as const

export function AttributeKindIcon({ kind, size = 17 }: { kind: AttributeKind; size?: number }) {
  const Icon = KIND_ICONS[kind] ?? IconList
  return (
    <span className="app-split-kind-icon" aria-hidden="true">
      <Icon size={size} stroke={1.8} />
    </span>
  )
}
