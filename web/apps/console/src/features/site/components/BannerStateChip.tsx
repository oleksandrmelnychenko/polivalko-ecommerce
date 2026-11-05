import { TableChip } from '@/shared/ui/TableChip'
import type { Banner } from '../api/siteApi'
import { displayDay, periodDay, periodState } from '../lib/period'

export function BannerStateChip({ banner }: { banner: Banner }) {
  const state = periodState(banner.isActive, banner.startsAt, banner.endsAt)
  if (state === 'off') return <TableChip dot tone="neutral" value="Вимкнений" />
  if (state === 'scheduled') return <TableChip dot tone="warning" value={`Покажеться з ${displayDay(periodDay(banner.startsAt))}`} />
  if (state === 'ended') return <TableChip dot tone="neutral" value="Показ завершився" />
  return <TableChip dot tone="success" value="Показується" />
}
