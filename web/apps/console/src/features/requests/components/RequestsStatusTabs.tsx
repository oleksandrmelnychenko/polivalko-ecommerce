import { IconChecklist, IconClipboardList, IconClock, IconInbox } from '@tabler/icons-react'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import type { RequestCounts, RequestStatus } from '../api/requestsApi'

const filters = [
  { value: '', label: 'Усі заявки', icon: IconClipboardList },
  { value: 'new', label: 'Нові', icon: IconInbox },
  { value: 'inProgress', label: 'В роботі', icon: IconClock },
  { value: 'done', label: 'Виконані', icon: IconChecklist },
] as const
const number = new Intl.NumberFormat('uk-UA')

export function RequestsStatusTabs({ status, counts, onChange }: { status: RequestStatus | ''; counts?: RequestCounts; onChange: (value: RequestStatus | '') => void }) {
  return (
    <div className="sales-status-cards request-filters" role="group" aria-label="Статус заявки">
      {filters.map(({ value, label, icon }) => {
        const count = value ? counts?.byStatus[value] : counts?.all
        return (
          <button type="button" key={value} className="sales-status-card" aria-pressed={status === value} onClick={() => onChange(value)}>
            <MetricLabel icon={icon}>{label}</MetricLabel>
            <strong>{count === undefined ? '—' : number.format(count)}</strong>
            <MetricTrack value={count ?? 0} max={counts?.all ?? 0} />
          </button>
        )
      })}
    </div>
  )
}
