import { ActionIcon, Tooltip } from '@mantine/core'
import { IconDeviceMobile, IconTrash } from '@tabler/icons-react'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import type { Banner } from '../api/siteApi'
import { periodLabel } from '../lib/period'
import { BannerStateChip } from './BannerStateChip'
import { MoveButtons } from './MoveButtons'

type BannersColumnsOptions = {
  count: number
  indexOf: (id: string) => number
  busy: boolean
  onMove: (index: number, delta: number) => void
  onDelete: (banner: Banner) => void
}

export function bannersColumns({ count, indexOf, busy, onMove, onDelete }: BannersColumnsOptions): DataTableColumn<Banner>[] {
  return [
    {
      id: 'order',
      header: 'Порядок',
      width: 120,
      cell: (row) => {
        const index = indexOf(row.id)
        return (
          <div className="site-order-cell">
            <span className="site-order-number">{index + 1}</span>
            <MoveButtons index={index} count={count} label={row.title} disabled={busy} onMove={(delta) => onMove(index, delta)} />
          </div>
        )
      },
    },
    {
      id: 'image',
      header: 'Фото',
      width: 132,
      cell: (row) => (
        <span className="site-banner-thumb">
          <img src={row.imageUrl} alt="" loading="lazy" />
          {row.mobileImageUrl ? (
            <span className="site-banner-mobile" title="Є окреме фото для телефона">
              <IconDeviceMobile size={12} stroke={1.8} aria-label="Є окреме фото для телефона" />
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'title',
      header: 'Заголовок і текст',
      fill: true,
      width: 300,
      cell: (row) => (
        <span className="site-banner-text">
          {row.kicker ? <span className="site-banner-kicker">{row.kicker}</span> : null}
          <CellStack title={row.title} sub={row.text ?? undefined} />
        </span>
      ),
    },
    {
      id: 'button',
      header: 'Кнопка',
      width: 220,
      cell: (row) =>
        row.link ? (
          <CellStack title={row.buttonLabel || <span className="site-muted">без напису</span>} sub={<span className="site-code">{row.link}</span>} />
        ) : (
          <span className="site-muted">немає</span>
        ),
    },
    {
      id: 'period',
      header: 'Період показу',
      width: 210,
      cell: (row) => <span className="app-number">{periodLabel(row.startsAt, row.endsAt)}</span>,
    },
    {
      id: 'state',
      header: 'Стан',
      width: 190,
      cell: (row) => <BannerStateChip banner={row} />,
    },
    {
      id: 'delete',
      header: <span className="visually-hidden">Дія</span>,
      width: 56,
      align: 'center',
      cell: (row) => (
        <Tooltip label="Видалити">
          <ActionIcon variant="subtle" color="red" aria-label={`Видалити банер «${row.title}»`} disabled={busy} onClick={() => onDelete(row)}>
            <IconTrash size={16} stroke={1.7} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ]
}
