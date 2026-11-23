import { Button } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconArrowLeft, IconChevronRight, IconDeviceFloppy } from '@tabler/icons-react'
import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { LeaveGuard } from '@/shared/ui/LeaveGuard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { getBanners, saveHome, type HomeSettings } from '../api/siteApi'
import { blockName, toHomeBody, toHomeForm, validateHome, type HomeForm } from '../lib/homeSettings'
import { periodEnd, periodStart, periodState } from '../lib/period'
import { useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { HomeSectionPane, HOME_STATUS, SECTION_ICONS, type HomeSectionKey } from './HomeSectionPane'

const FORM_ID = 'site-home-form'

type HomeSettingsFormProps = {
  initial: HomeSettings
  onSaved: (value: HomeSettings) => void
}

type SectionRow = {
  key: HomeSectionKey
  name: string
  state: keyof typeof HOME_STATUS
  invalid: boolean
}

function sectionOf(errorKey: string): string {
  return errorKey.split('.')[0]
}

export function HomeSettingsForm({ initial, onSaved }: HomeSettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useSaveForm(formRef)
  const [values, setValues] = useState(() => toHomeForm(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(toHomeBody(toHomeForm(initial))))
  const dirty = JSON.stringify(toHomeBody(values)) !== saved
  const banners = useApiQuery('site-banners', () => getBanners())
  const [params, setParams] = useSearchParams()
  const sections: HomeSectionKey[] = ['announcement', ...values.blocks.map((block) => block.key as HomeSectionKey)]
  const raw = params.get('block') as HomeSectionKey | null
  const section: HomeSectionKey = raw && sections.includes(raw) ? raw : 'announcement'
  const errorKeys = Object.keys(form.errors)
    .filter((key) => form.errors[key])
    .map(sectionOf)
    .join(',')

  const select = useCallback(
    (next: HomeSectionKey | null) =>
      setParams(
        (current) => {
          const query = new URLSearchParams(current)
          if (next) query.set('block', next)
          else query.delete('block')
          return query
        },
        { replace: true },
      ),
    [setParams],
  )

  useHotkeys([['mod+S', () => formRef.current?.requestSubmit()]], [])

  function patch(next: Partial<HomeForm>) {
    setValues((current) => ({ ...current, ...next }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || !dirty) return
    const errors = validateHome(values)
    const keys = Object.keys(errors)
    if (keys.length > 0) {
      form.invalid(errors)
      const first = sectionOf(keys[0]) as HomeSectionKey
      if (sections.includes(first)) select(first)
      return
    }
    const body = toHomeBody(values)
    const result = await form.submit((headers) => saveHome(headers, body), {
      done: 'Головну збережено.',
      failed: 'Налаштування головної не збережено.',
    })
    if (!result) return
    const next = result.data ?? body
    const nextForm = toHomeForm(next)
    setValues(nextForm)
    setSaved(JSON.stringify(toHomeBody(nextForm)))
    onSaved(next)
  }

  const { announcement, blocks } = values
  const rows = useMemo<SectionRow[]>(() => {
    const invalid = new Set(errorKeys.split(','))
    return [
      {
        key: 'announcement',
        name: 'Смуга оголошення',
        state: periodState(announcement.isActive && Boolean(announcement.text.trim()), periodStart(announcement.from), periodEnd(announcement.to)),
        invalid: invalid.has('announcement'),
      },
      ...blocks.map((block): SectionRow => {
        const key = block.key as HomeSectionKey
        return { key, name: blockName(key), state: block.visible ? 'live' : 'off', invalid: invalid.has(key) }
      }),
    ]
  }, [announcement, blocks, errorKeys])


  return (
    <>
      <PageHeader
        title="Головна"
        actions={
          <>
            {dirty ? <span className="site-home-dirty">Є незбережені зміни</span> : null}
            <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
              Зберегти зміни
            </Button>
          </>
        }
      />
      <form id={FORM_ID} ref={formRef} className="home-workspace site-form" data-editing={Boolean(raw && sections.includes(raw)) || undefined}
        onSubmit={onSubmit} noValidate aria-label="Налаштування головної сторінки">
        {form.error && <div className="home-form-error"><FormAlert error={form.error} /></div>}
        <section className="home-block-list" aria-labelledby="home-list-title">
          <header><h2 id="home-list-title">Блоки головної</h2><TableChip value={rows.length} /></header>
          <ol>
            {rows.map(row => {
              const Icon = SECTION_ICONS[row.key]
              return (
                <li key={row.key}>
                  <button type="button" className="home-block" data-block-key={row.key} aria-current={row.key === section ? 'true' : undefined}
                    onClick={() => { select(row.key); requestAnimationFrame(() => {
                      if (window.matchMedia('(max-width: 52em)').matches) document.getElementById('site-home-section-title')?.focus()
                    }) }}>
                    <span className="home-block-icon"><Icon size={17} stroke={1.7} /></span>
                    <span className="home-block-name">{row.name}
                      <TableChip tone={row.invalid ? 'danger' : HOME_STATUS[row.state].tone}
                        value={row.invalid ? 'Є помилки в полях' : HOME_STATUS[row.state].label} />
                    </span>
                    <IconChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
        <div className="home-block-editor">
          <Button type="button" className="home-back" variant="subtle" color="gray" size="xs"
            leftSection={<IconArrowLeft size={15} />} onClick={() => {
              select(null)
              requestAnimationFrame(() => formRef.current?.querySelector<HTMLButtonElement>(`[data-block-key="${section}"]`)?.focus())
            }}>Усі блоки</Button>
          <HomeSectionPane section={section} state={rows.find(row => row.key === section)?.state ?? 'off'} values={values} errors={form.errors} banners={banners.data ?? null} patch={patch} onClearField={form.clearField} />
        </div>
      </form>
      <LeaveGuard when={dirty} />
    </>
  )
}
