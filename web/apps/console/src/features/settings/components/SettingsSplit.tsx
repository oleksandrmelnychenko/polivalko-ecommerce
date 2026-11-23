import { NativeSelect } from '@mantine/core'
import { IconChevronRight, type IconPhone } from '@tabler/icons-react'
import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TableChip } from '@/shared/ui/TableChip'
import type { FieldErrors } from '../lib/useSaveForm'
import '@/shared/ui/split/split.css'
import '@/shared/ui/site/site-home.css'

export type SettingsSection<K extends string> = {
  key: K
  name: string
  hint: string
  icon: typeof IconPhone
  state: ReactNode
  invalid?: boolean
}

export function useSettingsSection<K extends string>(keys: readonly K[]): [K, (key: K) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('section') as K | null
  const active = raw && keys.includes(raw) ? raw : keys[0]
  const select = useCallback(
    (key: K) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('section', key)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  return [active, select]
}

export function useErrorSections<K extends string>(errors: FieldErrors, sectionOf: (field: string) => K | null): Set<K> {
  const signature = Object.keys(errors)
    .filter((key) => errors[key])
    .join('|')
  return useMemo(() => {
    const found = new Set<K>()
    for (const field of signature ? signature.split('|') : []) {
      const section = sectionOf(field)
      if (section) found.add(section)
    }
    return found
  }, [signature, sectionOf])
}

export function useJumpToErrors<K extends string>(sections: readonly K[], invalid: Set<K>, active: K, select: (key: K) => void) {
  const first = sections.find((key) => invalid.has(key)) ?? null
  const activeInvalid = invalid.has(active)
  const signature = sections.filter((key) => invalid.has(key)).join('|')
  const seen = useRef('')
  useEffect(() => {
    if (signature === seen.current) return
    seen.current = signature
    if (first && !activeInvalid) select(first)
  }, [signature, first, activeInvalid, select])
}

type SettingsSectionListProps<K extends string> = {
  label: string
  sections: SettingsSection<K>[]
  active: K
  onSelect: (key: K) => void
  top?: ReactNode
}

export function SettingsSectionList<K extends string>({ label, sections, active, onSelect, top }: SettingsSectionListProps<K>) {
  return (
    <div className="settings-navigation">
      <nav className="home-block-list" aria-label={label}>
        <header><h2>{label}</h2></header>
        <ol>
          {sections.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.key}>
                <button type="button" className="home-block" aria-current={item.key === active || undefined}
                  onClick={() => onSelect(item.key)} title={item.hint}>
                  <span className="home-block-icon"><Icon size={17} aria-hidden="true" /></span>
                  <span className="home-block-name">
                    {item.name}
                    {item.invalid ? <TableChip dot tone="danger" value="Перевірте поля" /> : item.state}
                  </span>
                  <IconChevronRight size={15} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <NativeSelect className="settings-section-select" aria-label={label} value={active}
        data={sections.map((item) => ({ value: item.key, label: item.name + (item.invalid ? ' · Перевірте поля' : '') }))}
        onChange={(event) => onSelect(event.currentTarget.value as K)} />
      {top && <div className="settings-list-top">{top}</div>}
    </div>
  )
}

type SettingsHeroProps<K extends string> = {
  section: SettingsSection<K>
  kicker: string
  description?: ReactNode
  actions?: ReactNode
}

export function SettingsHero<K extends string>({ section, kicker, description, actions }: SettingsHeroProps<K>) {
  const Icon = section.icon
  return (
    <header className="app-split-hero">
      <div className="app-split-hero-top">
        <div className="app-split-head">
          <span className="home-block-icon" aria-hidden="true">
            <Icon size={18} stroke={1.5} />
          </span>
          <div className="app-split-hero-main">
            <p className="app-split-hero-kicker">{kicker}</p>
            <h2>
              {section.name}
              {section.state}
            </h2>
            {description ? <div className="app-split-description">{description}</div> : null}
          </div>
        </div>
        {actions ? <div className="app-split-actions">{actions}</div> : null}
      </div>
    </header>
  )
}

type SettingsCardProps = {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function SettingsCard({ title, description, actions, children }: SettingsCardProps) {
  const id = useId()
  return (
    <section className="app-split-card" aria-labelledby={id}>
      <header className="app-split-card-head settings-card-head">
        <h3 id={id}>{title}</h3>
        {actions}
      </header>
      {description ? <p className="settings-card-description">{description}</p> : null}
      {children}
    </section>
  )
}

export function SettingsDirty({ dirty }: { dirty: boolean }) {
  return dirty ? <span className="settings-dirty">Є незбережені зміни</span> : null
}

export function FillState({ filled, total }: { filled: number; total: number }) {
  if (filled >= total) return <TableChip dot tone="success" value="Заповнено" />
  if (filled === 0) return <TableChip dot tone="warning" value="Порожньо" />
  return <TableChip dot tone="neutral" value={`Заповнено ${filled} з ${total}`} />
}
