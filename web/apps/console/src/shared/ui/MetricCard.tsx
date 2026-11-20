import type { Icon } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import './metric-card.css'

export function MetricLabel({ icon: Glyph, children }: { icon: Icon; children: ReactNode }) {
  return <span className="metric-label"><Glyph size={16} stroke={1.7} aria-hidden="true" />{children}</span>
}

export function MetricTrack({ value, max, muted = false }: { value: number; max: number; muted?: boolean }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0
  return <span className="metric-track" aria-hidden="true"><span data-muted={muted || undefined} style={{ width: `${percent}%` }} /></span>
}
