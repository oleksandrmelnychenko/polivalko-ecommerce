import { Button, Switch, Textarea, TextInput } from '@mantine/core'
import {
  IconArrowRight,
  IconBuildingStore,
  IconCategory,
  IconCircleCheck,
  IconDiscount,
  IconLayoutGrid,
  IconListNumbers,
  IconRestore,
  IconSlideshow,
  IconSpeakerphone,
  IconTool,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TableChip } from '@/shared/ui/TableChip'
import type { Banner, HomeBlockKey } from '../api/siteApi'
import { blockHint, blockName, DEFAULT_PERKS, DEFAULT_STEPS, DEFAULT_VISIT, itemRows, LIMITS, type HomeForm } from '../lib/homeSettings'
import { periodLabel, periodState } from '../lib/period'
import { fieldError, type FieldErrors } from '../lib/useSaveForm'
import { AnnouncementFields } from './AnnouncementFields'
import { ItemsEditor } from './ItemsEditor'
import { MoveButtons } from './MoveButtons'

export type HomeSectionKey = 'announcement' | HomeBlockKey

export const SECTION_ICONS: Record<HomeSectionKey, typeof IconSlideshow> = {
  announcement: IconSpeakerphone,
  hero: IconSlideshow,
  offers: IconDiscount,
  collections: IconLayoutGrid,
  categories: IconCategory,
  perks: IconCircleCheck,
  services: IconTool,
  steps: IconListNumbers,
  visit: IconBuildingStore,
}

export const HOME_STATUS = {
  off: { tone: 'neutral', label: 'Приховано' },
  scheduled: { tone: 'warning', label: 'Заплановано' },
  ended: { tone: 'neutral', label: 'Період минув' },
  live: { tone: 'success', label: 'Показується' },
} as const

type HomeLinkProps = { to: string; section: string; label: string }

const ABOUT: Partial<Record<HomeBlockKey, { text: string; link: HomeLinkProps }>> = {
  offers: {
    text: 'Сайт сам добирає товари в наявності зі справжньою знижкою: стара ціна вища за поточну. Якщо таких товарів немає, блок не показується.',
    link: { to: '/catalog/products', section: 'Каталог', label: 'Товари' },
  },
  collections: {
    text: 'Видимі добірки з товарами, у їхньому порядку. Перша показується великою секцією з фото й стрічкою товарів, решта стрічками.',
    link: { to: '/catalog/collections', section: 'Каталог', label: 'Добірки' },
  },
  categories: {
    text: 'Перші шість категорій верхнього рівня плитками з фото, нижче стрічка з усіма. Фото й порядок задаються в категоріях.',
    link: { to: '/catalog/categories', section: 'Каталог', label: 'Категорії' },
  },
  services: {
    text: 'Напрямки з вкладки «Послуги» з назвою й описом і кнопка «Залишити заявку».',
    link: { to: '/site/services', section: 'Сайт', label: 'Послуги' },
  },
}

type HomeSectionPaneProps = {
  section: HomeSectionKey
  state: keyof typeof HOME_STATUS
  values: HomeForm
  errors: FieldErrors
  banners: Banner[] | null
  patch: (next: Partial<HomeForm>) => void
  onClearField: (...path: (string | number)[]) => void
}

export function HomeSectionPane({ section, state, values, errors, banners, patch, onClearField }: HomeSectionPaneProps) {
  const Icon = SECTION_ICONS[section]
  const blockIndex = values.blocks.findIndex((block) => block.key === section)
  const block = blockIndex >= 0 ? values.blocks[blockIndex] : null

  function moveBlock(delta: number) {
    const target = blockIndex + delta
    if (blockIndex < 0 || target < 0 || target >= values.blocks.length) return
    const next = [...values.blocks]
    const [item] = next.splice(blockIndex, 1)
    next.splice(target, 0, item)
    patch({ blocks: next })
  }

  function toggleBlock(visible: boolean) {
    patch({ blocks: values.blocks.map((item) => (item.key === section ? { ...item, visible } : item)) })
  }

  const title = section === 'announcement' ? 'Смуга оголошення' : blockName(section)
  const status = HOME_STATUS[state]

  return (
    <section key={section} className="app-split-detail" aria-labelledby="site-home-section-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className="site-home-icon" aria-hidden="true">
              <Icon size={19} stroke={1.7} />
            </span>
            <div className="app-split-hero-main">
              {block && <p className="app-split-hero-kicker">Позиція <span className="home-position">{blockIndex + 1} / {values.blocks.length}</span></p>}
              <h2 id="site-home-section-title" tabIndex={-1}>
                {title}
                <TableChip dot tone={status.tone} value={status.label} />
              </h2>
              <p className="app-split-description">
                {section === 'announcement' ? 'Над шапкою на всіх сторінках магазину.' : blockHint(section)}
              </p>
            </div>
          </div>
          {block ? (
            <div className="app-split-actions site-home-actions">
              <span className="app-split-switch">
                <Switch size="sm" label="На головній" checked={block.visible} onChange={(event) => toggleBlock(event.currentTarget.checked)} />
              </span>
              <MoveButtons index={blockIndex} count={values.blocks.length} label={title} onMove={moveBlock} />
            </div>
          ) : null}
        </div>
      </header>

      {section === 'announcement' ? (
        <Card title="Текст і період">
          <AnnouncementFields value={values.announcement} errors={errors} onChange={(announcement) => patch({ announcement })} onClearField={onClearField} />
        </Card>
      ) : null}

      {section === 'hero' ? <HeroCard banners={banners} /> : null}

      {section === 'perks' || section === 'steps' ? (
        <Card
          title={section === 'perks' ? 'Пункти' : 'Кроки'}
          aside={
            <Button
              variant="subtle"
              size="xs"
              color="gray"
              leftSection={<IconRestore size={14} stroke={1.8} />}
              onClick={() => patch(section === 'perks' ? { perks: itemRows(DEFAULT_PERKS) } : { steps: itemRows(DEFAULT_STEPS) })}
            >
              Повернути типові тексти
            </Button>
          }
          note={section === 'perks' ? 'Стоять в один ряд під колекціями, найкраще виглядають 4 пункти.' : 'Номери кроків сайт ставить сам.'}
        >
          <ItemsEditor
            name={section}
            noun={section === 'perks' ? 'Перевага' : 'Крок'}
            items={values[section]}
            max={LIMITS[section]}
            errors={errors}
            onChange={(items) => patch(section === 'perks' ? { perks: items } : { steps: items })}
            onClearField={onClearField}
          />
        </Card>
      ) : null}

      {section === 'visit' ? (
        <Card
          title="Заголовок і текст"
          aside={
            <Button variant="subtle" size="xs" color="gray" leftSection={<IconRestore size={14} stroke={1.8} />} onClick={() => patch({ visit: { ...DEFAULT_VISIT } })}>
              Повернути типові тексти
            </Button>
          }
          note={
            <>
              Адресу, графік і телефон сайт бере з <Link to="/settings/shop">Налаштування → Магазин</Link>.
            </>
          }
        >
          <div className="site-visit-fields">
            <TextInput
              label="Заголовок"
              value={values.visit.title}
              maxLength={LIMITS.visitTitle}
              required
              error={fieldError(errors, 'visit', 'title')}
              onChange={(event) => {
                patch({ visit: { ...values.visit, title: event.currentTarget.value } })
                onClearField('visit', 'title')
              }}
            />
            <Textarea
              label="Підзаголовок"
              value={values.visit.text}
              maxLength={LIMITS.visitText}
              autosize
              minRows={2}
              error={fieldError(errors, 'visit', 'text')}
              onChange={(event) => {
                patch({ visit: { ...values.visit, text: event.currentTarget.value } })
                onClearField('visit', 'text')
              }}
            />
          </div>
        </Card>
      ) : null}

      {section !== 'announcement' && ABOUT[section] ? (
        <Card title="Звідки дані">
          <p className="site-home-about">{ABOUT[section].text}</p>
          <HomeLink {...ABOUT[section].link} icon={Icon} />
        </Card>
      ) : null}
    </section>
  )
}

function HomeLink({ to, section, label, icon: Icon }: HomeLinkProps & { icon: typeof IconSlideshow }) {
  return (
    <Link className="site-home-path" to={to} aria-label={`${section} → ${label}`}>
      <Icon className="site-path-icon" size={20} stroke={1.6} aria-hidden="true" />
      <span className="site-path-copy"><small>{section}</small><strong>{label}</strong></span>
      <IconArrowRight className="site-path-arrow" size={21} stroke={1.7} aria-hidden="true" />
    </Link>
  )
}

function Card({ title, aside, note, children }: { title: string; aside?: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="app-split-card" aria-label={title}>
      <header className="app-split-card-head">
        <h3>{title}</h3>
        {aside}
      </header>
      {note ? <p className="site-home-note">{note}</p> : null}
      {children}
    </section>
  )
}

function HeroCard({ banners }: { banners: Banner[] | null }) {
  const sorted = banners ? [...banners].sort((a, b) => a.sortOrder - b.sortOrder) : []
  const live = sorted.filter((banner) => periodState(banner.isActive, banner.startsAt, banner.endsAt) === 'live')

  return (
    <Card
      title="Слайди"
      aside={
        <HomeLink to="/site/banners" section="Сайт" label="Банери" icon={IconSlideshow} />
      }
      note={banners === null ? null : live.length === 0 ? <span className="site-warning-text">Зараз не показується жоден банер, слайдер на головній порожній.</span> : `Показується ${live.length} з ${sorted.length}, у цьому порядку.`}
    >
      {sorted.length ? (
        <ol className="site-home-slides">
          {sorted.map((banner) => {
            const on = live.includes(banner)
            return (
              <li key={banner.id} className={on ? undefined : 'is-off'}>
                <Link to={`/site/banners?id=${encodeURIComponent(banner.id)}`} className="site-home-slide">
                  <img src={banner.imageUrl} alt="" loading="lazy" />
                  <span className="site-home-slide-title">{banner.title}</span>
                  <span className="site-home-slide-meta">{on ? periodLabel(banner.startsAt, banner.endsAt) : 'не показується'}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      ) : banners === null ? null : (
        <p className="app-split-blank">Банерів ще немає.</p>
      )}
    </Card>
  )
}
