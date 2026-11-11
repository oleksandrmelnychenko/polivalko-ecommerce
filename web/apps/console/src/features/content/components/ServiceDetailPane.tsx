import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconExternalLink, IconPencil, IconPhoto } from '@tabler/icons-react'
import { plural } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import { TableChip } from '@/shared/ui/TableChip'
import type { ServiceDirection } from '../api/contentApi'

type ServiceDetailPaneProps = {
  direction: ServiceDirection | null
  position: number
  visibleCount: number
  onEdit: (direction: ServiceDirection) => void
}

export function ServiceDetailPane({ direction, position, visibleCount, onEdit }: ServiceDetailPaneProps) {
  if (!direction) return <section className="app-split-detail app-split-detail-empty">Оберіть напрямок зліва.</section>

  return (
    <section key={direction.code} className="app-split-detail" aria-labelledby="content-service-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className="content-service-photo" aria-hidden="true">
              {direction.imageUrl ? <img src={direction.imageUrl} alt="" /> : <IconPhoto size={26} stroke={1.5} />}
            </span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker app-split-mono">{direction.code}</p>
              <h2 id="content-service-title">
                {direction.name}
                {direction.isVisible ? <TableChip dot tone="success" value="Показується" /> : <TableChip dot tone="neutral" value="Прихований" />}
              </h2>
              {direction.description ? <p className="app-split-description">{direction.description}</p> : null}
            </div>
          </div>
          <div className="app-split-actions">
            <Button variant="default" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(direction)}>
              Змінити
            </Button>
            <Tooltip label="Сторінка послуг на сайті">
              <ActionIcon component="a" href={siteUrl('/services')} target="_blank" rel="noopener" variant="subtle" color="gray" size="lg" aria-label="Відкрити сторінку послуг на сайті">
                <IconExternalLink size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
        <dl className="app-split-stats is-text">
          <div>
            <dt>Місце на сторінці</dt>
            <dd>
              {direction.isVisible ? `${position} з ${visibleCount}` : 'не показується'}
              <small>поле «Порядок»: {direction.sortOrder}</small>
            </dd>
          </div>
          <div>
            <dt>Фото</dt>
            <dd>{direction.imageUrl ? 'є' : <span className="app-split-value-empty">немає</span>}</dd>
          </div>
          <div>
            <dt>Опис</dt>
            <dd>{direction.description ? `${direction.description.length} ${plural(direction.description.length, 'символ', 'символи', 'символів')}` : <span className="app-split-value-empty">немає</span>}</dd>
          </div>
        </dl>
      </header>

      <section className="app-split-card" aria-labelledby="content-service-preview">
        <header className="app-split-card-head">
          <h3 id="content-service-preview">На сторінці послуг</h3>
          {direction.isVisible ? null : <span>прихований напрямок відвідувачі не бачать</span>}
        </header>
        <div className={`content-service-preview${direction.isVisible ? '' : ' is-hidden'}`}>
          <span className="content-service-preview-photo">
            {direction.imageUrl ? <img src={direction.imageUrl} alt="" /> : <IconPhoto size={22} stroke={1.4} aria-hidden="true" />}
          </span>
          <span className="content-service-preview-text">
            <strong>{direction.name}</strong>
            <span>{direction.description ?? 'Опису немає.'}</span>
          </span>
        </div>
      </section>
    </section>
  )
}
