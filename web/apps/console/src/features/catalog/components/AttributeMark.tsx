import type { Icon } from '@tabler/icons-react'

export function AttributeMark({ icon: Glyph, size = 17 }: { icon: Icon; size?: number }) {
  return (
    <span className="app-split-kind-icon" aria-hidden="true">
      <Glyph size={size} stroke={1.8} />
    </span>
  )
}
