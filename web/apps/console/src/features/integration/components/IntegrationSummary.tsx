import { Alert } from '@mantine/core'
import { IconAlertTriangle, IconClockPlay, IconCurrencyHryvnia, IconPlugConnected, IconStack2 } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { plural } from '@polivalko/shared/lib/format'
import type { IntegrationStatus } from '../api/integrationApi'
import { countFormat } from '../lib/labels'

type Tone = 'good' | 'bad' | 'muted'

type TileProps = {
  icon: ReactNode
  label: string
  value: string
  sub: ReactNode
  tone: Tone
  onClick?: () => void
}

const navkoloMode: Record<string, { value: string; sub: string; tone: Tone }> = {
  DNTrade: { value: 'API Навколо.Торгівля', sub: 'обмін з обліком увімкнено', tone: 'good' },
  Stub: { value: 'Тестова заглушка', sub: 'обмін з Navkolo імітується', tone: 'muted' },
  Disabled: { value: 'Вимкнено', sub: 'ціни й залишки з імпорту файлів', tone: 'muted' },
}

function Tile({ icon, label, value, sub, tone, onClick }: TileProps) {
  const body = (
    <>
      <span className="integration-tile-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="integration-tile-text">
        <span className="integration-tile-label">{label}</span>
        <span className="integration-tile-value">{value}</span>
        <span className="integration-tile-sub">{sub}</span>
      </span>
    </>
  )
  return onClick ? (
    <button type="button" className={`integration-tile is-${tone} is-link`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`integration-tile is-${tone}`}>{body}</div>
  )
}

type IntegrationSummaryProps = {
  status: IntegrationStatus
  onOpenOutbox?: () => void
  onOpenJob: (job: string) => void
}

export function IntegrationSummary({ status, onOpenOutbox, onOpenJob }: IntegrationSummaryProps) {
  const mode = navkoloMode[status.navkoloMode] ?? { value: status.navkoloMode, sub: 'режим обміну з обліком', tone: 'muted' as const }
  const failing = status.jobs.filter((job) => job.consecutiveFailures > 0)
  const queued = status.outboxPending
  const failed = status.outboxFailed

  return (
    <div className="integration-head">
      {!status.catalogDataFresh ? (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title="Ціни й залишки застаріли" role="status" className="integration-stale">
          Сайт приймає нові замовлення як заявки без онлайн-оплати й без резерву: менеджер підтверджує ціну й наявність вручну. Онлайн-оплата повернеться
          після вдалої синхронізації цін і залишків з Navkolo.
        </Alert>
      ) : null}
      <div className="integration-tiles">
        <Tile icon={<IconPlugConnected size={20} stroke={1.7} />} label="Обмін з Navkolo" value={mode.value} sub={mode.sub} tone={mode.tone} />
        <Tile
          icon={<IconCurrencyHryvnia size={20} stroke={1.7} />}
          label="Ціни й залишки"
          value={status.catalogDataFresh ? 'Актуальні' : 'Застарілі'}
          sub={status.catalogDataFresh ? 'онлайн-оплата доступна' : 'замовлення йдуть як заявки'}
          tone={status.catalogDataFresh ? 'good' : 'bad'}
          onClick={() => onOpenJob('navkolo.price-stock')}
        />
        <Tile
          icon={<IconClockPlay size={20} stroke={1.7} />}
          label="Фонові завдання"
          value={failing.length ? `${failing.length} зі збоєм` : 'Без збоїв'}
          sub={failing.length ? failing.map((job) => job.title).join(', ') : `усього ${status.jobs.length} ${plural(status.jobs.length, 'завдання', 'завдання', 'завдань')}`}
          tone={failing.length ? 'bad' : 'good'}
          onClick={failing.length ? () => onOpenJob(failing[0].job) : undefined}
        />
        <Tile
          icon={<IconStack2 size={20} stroke={1.7} />}
          label="Черга операцій"
          value={failed ? `${countFormat.format(failed)} не виконано` : queued ? `${countFormat.format(queued)} у черзі` : 'Порожня'}
          sub={failed ? 'потрібен ручний повтор' : queued ? 'фонова служба їх виконає' : 'невиконаних операцій немає'}
          tone={failed ? 'bad' : 'good'}
          onClick={onOpenOutbox}
        />
      </div>
    </div>
  )
}
