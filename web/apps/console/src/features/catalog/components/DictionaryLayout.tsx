import { IconChevronLeft, type Icon } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'

export function DictionaryLayout({ picked, onBack, children }: { picked: boolean; onBack: () => void; children: ReactNode }) {
  return (
    <div className="app-split-layout" data-picked={picked || undefined}>
      <button type="button" className="category-back" onClick={onBack}><IconChevronLeft size={16} />До списку</button>
      {children}
    </div>
  )
}

export function DictionaryLink({ id, children }: { id: string; children: ReactNode }) {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set('id', id)
  return <Link className="dictionary-link app-split-name-cell" to={{ search: next.toString() }} replace>{children}</Link>
}

export function DictionaryMetric({ icon, label, value, note, part, total }: {
  icon: Icon
  label: string
  value: ReactNode
  note?: string
  part?: number
  total?: number | null
}) {
  return (
    <div>
      <dt><MetricLabel icon={icon}>{label}</MetricLabel></dt>
      <dd>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
        {part != null && total != null && total > 0 && <MetricTrack value={part} max={total} />}
      </dd>
    </div>
  )
}
