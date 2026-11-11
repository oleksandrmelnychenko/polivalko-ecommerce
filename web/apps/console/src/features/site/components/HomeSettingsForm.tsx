import { Button } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { getBanners, saveHome, type HomeSettings } from '../api/siteApi'
import { blockHint, blockName, toHomeBody, toHomeForm, validateHome, type HomeForm } from '../lib/homeSettings'
import { periodEnd, periodStart, periodState } from '../lib/period'
import { useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { HomeSectionPane, SECTION_ICONS, type HomeSectionKey } from './HomeSectionPane'

const FORM_ID = 'site-home-form'

type HomeSettingsFormProps = {
  initial: HomeSettings
  onSaved: (value: HomeSettings) => void
}

type SectionRow = {
  key: HomeSectionKey
  name: string
  hint: string
  visible: boolean
  invalid: boolean
}

const getSectionId = (row: SectionRow) => row.key

const SECTION_COLUMNS: DataTableColumn<SectionRow>[] = [
  {
    id: 'name',
    header: 'Блок',
    fill: true,
    width: 320,
    minWidth: 240,
    cell: (row) => {
      const Icon = SECTION_ICONS[row.key]
      return (
        <span className="app-split-name-cell">
          <span className="app-split-kind-icon">
            <Icon size={16} stroke={1.6} />
          </span>
          <span className="app-split-row-text">
            <span className="app-split-item-name">{row.name}</span>
            <span className={`app-split-row-sub${row.invalid ? ' site-home-invalid' : ''}`}>{row.invalid ? 'Є помилки в полях' : row.hint}</span>
          </span>
        </span>
      )
    },
  },
  {
    id: 'visible',
    header: 'На сайті',
    width: 150,
    cell: (row) => (row.visible ? <TableChip dot tone="success" value="Показується" /> : <TableChip dot tone="neutral" value="Приховано" />),
  },
]

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
    (next: HomeSectionKey) =>
      setParams(
        (current) => {
          const query = new URLSearchParams(current)
          query.set('block', next)
          return query
        },
        { replace: true },
      ),
    [setParams],
  )

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

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
        hint: 'Рядок над шапкою сайту',
        visible: periodState(announcement.isActive && Boolean(announcement.text.trim()), periodStart(announcement.from), periodEnd(announcement.to)) === 'live',
        invalid: invalid.has('announcement'),
      },
      ...blocks.map((block) => {
        const key = block.key as HomeSectionKey
        return { key, name: blockName(key), hint: blockHint(key), visible: block.visible, invalid: invalid.has(key) }
      }),
    ]
  }, [announcement, blocks, errorKeys])

  const rowClassName = useCallback((row: SectionRow) => (row.key === section ? 'app-split-row-active' : undefined), [section])

  return (
    <ListPage>
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
      <ListPageBody>
        <form id={FORM_ID} ref={formRef} className="app-split-layout site-form" onSubmit={onSubmit} noValidate aria-label="Налаштування головної сторінки">
          <div className="app-split-list">
            {form.error ? (
              <div className="site-home-alert">
                <FormAlert error={form.error} />
              </div>
            ) : null}
            <DataTable
              ariaLabel="Блоки головної за порядком"
              columns={SECTION_COLUMNS}
              data={rows}
              getRowId={getSectionId}
              minWidth={480}
              height="100%"
              onRowClick={(row) => select(row.key)}
              rowClassName={rowClassName}
            />
          </div>
          <HomeSectionPane section={section} values={values} errors={form.errors} banners={banners.data ?? null} patch={patch} onClearField={form.clearField} />
        </form>
      </ListPageBody>
    </ListPage>
  )
}
