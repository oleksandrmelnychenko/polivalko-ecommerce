import { ActionIcon, Button, Group, Tooltip } from '@mantine/core'
import { IconEye, IconEyeOff, IconLayoutGrid, IconPackageOff, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { CatalogEditorModal } from '../components/CatalogEditorModal'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import { ScreenTabs } from '@/shared/ui/ScreenTabs'
import { listEmptyText } from '../components/ListEmpty'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifySuccess } from '@/shared/ui/notify'
import { DictionaryLayout, DictionaryLink } from '../components/DictionaryLayout'
import { PageHeader } from '@/shared/ui/PageHeader'
import { deleteCollection, getCollections, type ConsoleCollection } from '../api/catalogApi'
import { CollectionDetailPane } from '../components/CollectionDetailPane'
import { CollectionForm } from '../components/CollectionForm'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '@/shared/ui/split/split.css'
import '../components/catalog-detail.css'
import '../components/catalog-collections.css'
import { DrawerCancelButton } from '@/shared/ui/DrawerCancelButton'

const FORM_ID = 'catalog-collection-form'
const getRowId = (row: ConsoleCollection) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

const PARAM_KEYS = ['id', 'show'] as const
const selections = [
  { value: '', label: 'Усі добірки', icon: IconLayoutGrid, matches: () => true },
  { value: 'enabled', label: 'Увімкнені', icon: IconEye, matches: (row: ConsoleCollection) => row.isVisible },
  { value: 'hidden', label: 'Приховані', icon: IconEyeOff, matches: (row: ConsoleCollection) => !row.isVisible },
  { value: 'empty', label: 'Без товарів', icon: IconPackageOff, matches: (row: ConsoleCollection) => row.products.length === 0 },
] as const

const columns: DataTableColumn<ConsoleCollection>[] = [
  {
    id: 'title',
    header: 'Добірка',
    width: 180,
    minWidth: 144,
    fill: true,
    cell: (row) => (
      <DictionaryLink id={row.id}>
        <span className="app-split-kind-icon"><IconLayoutGrid size={16} aria-hidden="true" /></span>
        <span className="category-row-text">
          <span className="app-split-item-name">{row.title}</span>
          <small>{row.code} · {row.isVisible ? 'Увімкнена' : 'Прихована'}</small>
        </span>
      </DictionaryLink>
    ),
  },
  {
    id: 'products',
    header: 'Товарів',
    width: 100,
    align: 'right',
    numeric: true,
    cell: (row) => <span className="app-split-item-count">{countFormat.format(row.products.length)}</span>,
  },
]

type Editing = { collection: ConsoleCollection | null; key: number }

export function CollectionsPage() {
  const collections = useApiQuery('catalog-collections', () => getCollections())
  const [editing, setEditing] = useState<Editing | null>(null)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formDirty, setFormDirty] = useState(false)

  const open = useCallback((collection: ConsoleCollection | null) => {
    setDeleteError(null)
    setFormDirty(false)
    setEditing({ collection, key: Date.now() })
    setOpened(true)
  }, [])

  function close() {
    if (busy) return
    setOpened(false)
  }

  function saved(savedCollection: ConsoleCollection) {
    pick({ id: savedCollection.id, show: selection.matches(savedCollection) ? selection.value : null })
    setOpened(false)
    notifySuccess('Добірку збережено.')
    collections.reload()
  }

  async function remove() {
    const collection = editing?.collection
    if (!collection) return
    setBusy(true)
    try {
      const result = await withCsrf((headers) => deleteCollection(headers, collection.id))
      setConfirming(false)
      if (result.response.ok) {
        setOpened(false)
        notifySuccess(`Добірку «${collection.title}» видалено.`)
        collections.reload()
      } else {
        setDeleteError(problemMessage(result.error, 'Добірку не видалено.'))
      }
    } catch {
      setConfirming(false)
      setDeleteError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  const current = editing?.collection ?? null
  const all = useMemo(() => collections.status === 'error' || collections.status === 'forbidden' ? [] : collections.data ?? [], [collections.data, collections.status])
  const { values: picked, set: pick } = useListParams(PARAM_KEYS)
  const selection = selections.find((item) => item.value === picked.show) ?? selections[0]
  const rows = useMemo(() => all.filter(selection.matches), [all, selection])
  const selected = rows.find((row) => row.id === picked.id) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null
  const selectRow = useCallback((row: ConsoleCollection) => pick({ id: row.id }), [pick])
  const rowClassName = useCallback((row: ConsoleCollection) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])
  const emptyText = listEmptyText(collections, 'Не вдалося завантажити добірки.', selection.value ? 'У цій вибірці немає добірок.' : 'Добірок ще немає.')

  return (
    <ListPage className="catalog-dictionary-page catalog-collections-page">
      <PageHeader
        title="Добірки"
        actions={
          <>
            <Tooltip label="Оновити">
              <ActionIcon variant="default" radius="xl" aria-label="Оновити" loading={collections.isFetching} onClick={collections.reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>Нова добірка</Button>
          </>
        }
      />

      <ScreenTabs
        label="Вибірка добірок"
        value={selection.value}
        onChange={(show) => pick({ show, id: null })}
        tabs={selections.map(({ value, label, icon, matches }) => {
          const count = collections.data && collections.status === 'ready' ? all.filter(matches).length : null
          return { value, label: <MetricLabel icon={icon}>{label}</MetricLabel>, count, footer: <MetricTrack value={count ?? 0} max={all.length} /> }
        })}
      />

      <ListPageBody>
        <DictionaryLayout picked={Boolean(selectedId && picked.id === selectedId)} onBack={() => pick({ id: null })}>
          <div className="app-split-list">
            <DataTable
              ariaLabel="Добірки"
              columns={columns}
              data={rows}
              getRowId={getRowId}
              isLoading={collections.isLoading}
              isFetching={collections.isFetching}
              minWidth={240}
              height="100%"
              manualSorting
              onRowClick={selectRow}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <CollectionDetailPane collection={selected} onEdit={open} />
        </DictionaryLayout>
      </ListPageBody>

      <CatalogEditorModal
        icon={IconLayoutGrid}
        opened={opened}
        onClose={close}
        dirty={formDirty && !busy}
        title={current ? `Добірка «${current.title}»` : 'Нова добірка'}
        size="standard"
        className="collection-editor-modal"
        closeOnEscape={!busy && !confirming}
        closeOnClickOutside={!busy && !confirming}
        footer={
          <Group justify="space-between" w="100%">
            {current ? (
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} stroke={1.7} />} disabled={busy} onClick={() => setConfirming(true)}>
                Видалити
              </Button>
            ) : (
              <span />
            )}
            <Group gap="xs">
              <DrawerCancelButton disabled={busy} onCancel={close} />
              <Button type="submit" form={FORM_ID} loading={busy}>
                Зберегти добірку
              </Button>
            </Group>
          </Group>
        }
      >
        {editing ? <CollectionForm key={editing.key} formId={FORM_ID} collection={editing.collection} error={deleteError} onBusy={setBusy} onSaved={saved} onDirty={setFormDirty} /> : null}
      </CatalogEditorModal>

      <ConfirmDialog
        opened={confirming}
        title="Видалити добірку"
        message={current ? `Добірка «${current.title}» зникне з головної. Скасувати видалення не можна.` : ''}
        confirmLabel="Видалити добірку"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirming(false)}
      />
    </ListPage>
  )
}
