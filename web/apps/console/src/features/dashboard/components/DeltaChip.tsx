import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { delta } from '../lib/insights'

export function DeltaChip({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  const value = delta(current, previous, inverse)
  if (value.kind === 'flat') return <span className="dash-delta is-flat">{value.label}</span>
  const Icon = value.kind === 'up' ? IconTrendingUp : IconTrendingDown
  return (
    <span className={`dash-delta ${value.good ? 'is-good' : 'is-bad'}`}>
      <Icon size={13} stroke={2} aria-hidden="true" />
      {value.label}
    </span>
  )
}
