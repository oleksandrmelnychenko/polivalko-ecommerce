import type { DataTableColumn } from '@/shared/ui/data-table/types'
import type { Banner } from '../api/siteApi'
import { BannerStateChip } from './BannerStateChip'

export const BANNER_COLUMNS: DataTableColumn<Banner>[] = [
  {
    id: 'title',
    header: 'Банер',
    fill: true,
    width: 320,
    minWidth: 240,
    cell: (row) => (
      <span className="app-split-name-cell">
        <span className="site-banner-thumb">
          <img src={row.imageUrl} alt="" loading="lazy" />
        </span>
        <span className="app-split-row-text">
          <span className="app-split-item-name">{row.title}</span>
          <span className="app-split-row-sub">{row.kicker ?? row.text ?? 'без тексту'}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'state',
    header: 'Стан',
    width: 200,
    cell: (row) => <BannerStateChip banner={row} />,
  },
]
