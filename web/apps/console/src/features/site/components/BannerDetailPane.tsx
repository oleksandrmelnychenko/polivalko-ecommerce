import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconDeviceDesktop, IconDeviceMobile, IconExternalLink, IconPencil, IconTrash } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { Banner } from '../api/siteApi'
import { periodLabel } from '../lib/period'
import { BannerStateChip } from './BannerStateChip'
import { MoveButtons } from './MoveButtons'

type BannerDetailPaneProps = {
  banner: Banner | null
  index: number
  count: number
  busy: boolean
  onEdit: (banner: Banner) => void
  onDelete: (banner: Banner) => void
  onMove: (index: number, delta: number) => void
}

function linkHref(link: string): string {
  return link.startsWith('/') ? siteUrl(link) : link
}

export function BannerDetailPane({ banner, index, count, busy, onEdit, onDelete, onMove }: BannerDetailPaneProps) {
  if (!banner) return <section className="app-split-detail app-split-detail-empty">Оберіть банер зліва або додайте новий.</section>

  const rows: [string, ReactNode][] = [
    ['Напис над заголовком', banner.kicker ?? <span className="app-split-value-empty">немає</span>],
    ['Заголовок', banner.title],
    ['Текст', banner.text ?? <span className="app-split-value-empty">немає</span>],
    ['Кнопка', banner.buttonLabel ?? <span className="app-split-value-empty">{banner.link ? 'без напису' : 'немає'}</span>],
    [
      'Посилання',
      banner.link ? (
        <a className="app-split-link" href={linkHref(banner.link)} target="_blank" rel="noopener">
          {banner.link}
          <IconExternalLink size={13} stroke={1.8} aria-hidden="true" />
        </a>
      ) : (
        <span className="app-split-value-empty">немає, слайд не клікається</span>
      ),
    ],
  ]

  return (
    <section key={banner.id} className="app-split-detail" aria-labelledby="site-banner-title">
      <header className="app-split-hero">
        <div className="site-banner-stage">
          <figure className="site-banner-desktop">
            <img src={banner.imageUrl} alt="" />
            <figcaption>
              <IconDeviceDesktop size={13} stroke={1.8} aria-hidden="true" />
              Комп&apos;ютер
            </figcaption>
          </figure>
          <figure className="site-banner-phone">
            <img src={banner.mobileImageUrl ?? banner.imageUrl} alt="" />
            <figcaption>
              <IconDeviceMobile size={13} stroke={1.8} aria-hidden="true" />
              {banner.mobileImageUrl ? 'Телефон' : 'Телефон, те саме фото'}
            </figcaption>
          </figure>
        </div>
        <div className="app-split-hero-top">
          <div className="app-split-hero-main">
            <p className="app-split-hero-kicker">
              Слайд {index + 1} з {count}
            </p>
            <h2 id="site-banner-title">
              {banner.title}
              <BannerStateChip banner={banner} />
            </h2>
          </div>
          <div className="app-split-actions">
            <Button variant="default" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(banner)}>
              Змінити
            </Button>
            <Tooltip label="Видалити банер">
              <ActionIcon variant="subtle" color="red" size="lg" aria-label={`Видалити банер «${banner.title}»`} disabled={busy} onClick={() => onDelete(banner)}>
                <IconTrash size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
        <dl className="app-split-stats is-text">
          <div>
            <dt>Позиція в слайдері</dt>
            <dd>
              <span className="app-split-mono">
                {index + 1} / {count}
              </span>
              <MoveButtons index={index} count={count} label={banner.title} disabled={busy} onMove={(delta) => onMove(index, delta)} />
            </dd>
          </div>
          <div>
            <dt>Період показу</dt>
            <dd>{periodLabel(banner.startsAt, banner.endsAt)}</dd>
          </div>
          <div>
            <dt>Оновлено</dt>
            <dd>{formatDateTime(banner.updatedAt)}</dd>
          </div>
        </dl>
      </header>

      <section className="app-split-card" aria-labelledby="site-banner-content">
        <header className="app-split-card-head">
          <h3 id="site-banner-content">Вміст слайда</h3>
        </header>
        <dl className="app-split-fields">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  )
}
