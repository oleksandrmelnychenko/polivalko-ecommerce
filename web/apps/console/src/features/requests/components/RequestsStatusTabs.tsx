import { serviceRequestStatusLabel } from '@polivalko/shared/lib/labels'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import { REQUEST_STATUSES, type RequestCounts, type RequestStatus } from '../api/requestsApi'

type TabValue = RequestStatus | 'all'

export function RequestsStatusTabs({ status, counts, onChange }: { status: RequestStatus | ''; counts?: RequestCounts; onChange: (status: RequestStatus | '') => void }) {
  const tabs: ScreenTab<TabValue>[] = [
    { value: 'all', label: 'Усі', count: counts ? counts.all : null },
    ...REQUEST_STATUSES.map((value) => ({
      value,
      label: serviceRequestStatusLabel[value] ?? value,
      count: counts ? counts.byStatus[value] : null,
      hot: value === 'new',
    })),
  ]

  return <ScreenTabs<TabValue> label="Статус заявки" tabs={tabs} value={status || 'all'} onChange={(value) => onChange(value === 'all' ? '' : value)} />
}
