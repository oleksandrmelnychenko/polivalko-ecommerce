import type { LabelTone } from '../api/dictionariesApi'
import './catalog-dictionaries.css'

type LabelChipProps = {
  name: string
  tone: LabelTone
  muted?: boolean
  title?: string
}

export function LabelChip({ name, tone, muted = false, title }: LabelChipProps) {
  return (
    <span className={`catalog-label-chip is-${tone}${muted ? ' is-muted' : ''}`} title={title ?? name}>
      {name}
    </span>
  )
}
