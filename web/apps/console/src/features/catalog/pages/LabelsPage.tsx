import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconBolt, IconEyeOff, IconHandClick, IconPlus, IconRefresh, IconTag, IconTags } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { CatalogEditorModal } from '../components/CatalogEditorModal'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import { ScreenTabs } from '@/shared/ui/ScreenTabs'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { DictionaryLayout, DictionaryLink } from '../components/DictionaryLayout'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getProductCounts } from '../api/catalogApi'
import { deleteLabel, getLabels, saveLabel, type ProductLabel } from '../api/dictionariesApi'
import { EditorDrawerFooter } from '../components/EditorDrawerFooter'
import { LabelChip } from '../components/LabelChip'
import { LABEL_ICONS } from '../components/labelIcon'
import { LabelDetailPane } from '../components/LabelDetailPane'
import { LabelForm } from '../components/LabelForm'
import { listEmptyText } from '../components/ListEmpty'
import { canDeleteLabel, isAutoLabel, sortLabels } from '../lib/labels'
import { useEditorDrawer } from '../lib/useEditorDrawer'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '../components/catalog-dictionaries.css'
import '@/shared/ui/split/split.css'
import '../components/catalog-detail.css'
import '../components/catalog-labels.css'

const FORM_ID = 'catalog-label-form'
const getRowId = (row: ProductLabel) => row.id
const PARAM_KEYS = ['id', 'show'] as const
const selections = [
  { value: '', title: 'Усі мітки', icon: IconTags, matches: () => true },
  { value: 'manual', title: 'Ручні', icon: IconHandClick, matches: (label: ProductLabel) => !isAutoLabel(label) },
  { value: 'automatic', title: 'Автоматичні', icon: IconBolt, matches: isAutoLabel },
  { value: 'inactive', title: 'Вимкнені', icon: IconEyeOff, matches: (label: ProductLabel) => !label.isActive },
] as const
const countFormat = new Intl.NumberFormat('uk-UA')

export function LabelsPage() {
  const { can } = usePermissions()
  const labels = useApiQuery('catalog-labels', () => getLabels())
  const drawer = useEditorDrawer<ProductLabel>()
  const { open, current } = drawer
  const [toggling, setToggling] = useState<string | null>(null)

  const all = useMemo(() => sortLabels(labels.data ?? []), [labels.data])
  const { values, set } = useListParams(PARAM_KEYS)
  const selection = selections.find((item) => item.value === values.show) ?? selections[0]
  const rows = useMemo(() => all.filter(selection.matches), [all, selection])
  const nextSortOrder = all.length ? Math.max(...all.map((row) => row.sortOrder)) + 10 : 10
  const { reload, setData } = labels

  const selected = rows.find((row) => row.id === values.id) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null
  const productCounts = useApiQuery('catalog-products-counts', () => getProductCounts(), { enabled: can(PermissionKeys.Catalog.ViewProducts) })
  const selectRow = useCallback((row: ProductLabel) => set({ id: row.id }), [set])
  const rowClassName = useCallback((row: ProductLabel) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  async function toggle(label: ProductLabel, isActive: boolean) {
    setToggling(label.id)
    try {
      const result = await withCsrf((headers) =>
        saveLabel(headers, label.id, { name: label.name, tone: label.tone, kind: label.kind, newDays: label.newDays, sortOrder: label.sortOrder, isActive }),
      )
      if (result.response.ok) {
        notifySuccess(`Мітку «${label.name}» ${isActive ? 'увімкнено' : 'вимкнено'}.`)
        reload()
      } else {
        notifyError(problemMessage(result.error, 'Мітку не збережено.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setToggling(null)
  }

  const columns = useMemo<DataTableColumn<ProductLabel>[]>(
    () => [
      {
        id: 'preview',
        header: 'Мітка',
        width: 200,
        fill: true,
        minWidth: 150,
        cell: (row) => {
          const Glyph = LABEL_ICONS[row.kind]
          return (
            <DictionaryLink id={row.id}>
              <span className="app-split-kind-icon" aria-hidden="true"><Glyph size={16} /></span>
              <span className="label-row-text">
                <LabelChip name={row.name} tone={row.tone} muted={!row.isActive} />
                <small>{isAutoLabel(row) ? 'Автоматична' : 'Ручна'}{row.isActive ? '' : ' · Вимкнена'}</small>
              </span>
            </DictionaryLink>
          )
        },
      },
      {
        id: 'products',
        header: 'Товарів',
        width: 100,
        align: 'right',
        numeric: true,
        cell: (row) => <span className="app-split-item-count">{countFormat.format(row.productCount)}</span>,
      },
    ],
    [],
  )

  function saved(label?: ProductLabel) {
    drawer.setOpened(false)
    if (label) set({ id: label.id, show: selection.matches(label) ? selection.value : null })
    notifySuccess('Мітку збережено.')
    reload()
  }

  async function remove() {
    if (!current) return
    drawer.setBusy(true)
    try {
      const result = await withCsrf((headers) => deleteLabel(headers, current.id))
      drawer.setConfirming(false)
      if (result.response.ok) {
        drawer.setOpened(false)
        notifySuccess(`Мітку «${current.name}» видалено.`)
        setData(all.filter((row) => row.id !== current.id))
        reload()
      } else {
        drawer.setActionError(problemMessage(result.error, 'Мітку не видалено.'))
      }
    } catch {
      drawer.setConfirming(false)
      drawer.setActionError(NETWORK_ERROR)
    }
    drawer.setBusy(false)
  }

  const deletable = current !== null && canDeleteLabel(current)

  return (
    <ListPage className="catalog-dictionary-page catalog-labels-page">
      <PageHeader
        title="Мітки"
        actions={
          <>
            <Tooltip label="Оновити">
              <ActionIcon variant="default" radius="xl" aria-label="Оновити" loading={labels.isFetching} onClick={reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
              Нова мітка
            </Button>
          </>
        }
      />

      <ScreenTabs
        label="Вибірка міток"
        value={selection.value}
        onChange={(show) => set({ show, id: null })}
        tabs={selections.map(({ value, title, icon, matches }) => {
          const count = labels.data ? all.filter(matches).length : null
          return { value, label: <MetricLabel icon={icon}>{title}</MetricLabel>, count, footer: <MetricTrack value={count ?? 0} max={all.length} /> }
        })}
      />

      <ListPageBody>
        <DictionaryLayout picked={Boolean(selectedId && values.id === selectedId)} onBack={() => set({ id: null })}>
          <div className="app-split-list">
            <DataTable
              ariaLabel="Мітки товарів"
              columns={columns}
              data={labels.status === 'error' || labels.status === 'forbidden' ? [] : rows}
              getRowId={getRowId}
              isLoading={labels.isLoading}
              isFetching={labels.isFetching}
              minWidth={240}
              height="100%"
              manualSorting
              onRowClick={selectRow}
              rowClassName={rowClassName}
              emptyText={listEmptyText(labels, 'Не вдалося завантажити мітки.', selection.value ? 'У цій вибірці немає міток.' : 'Міток ще немає.')}
            />
          </div>
          <LabelDetailPane
            label={selected}
            totalProducts={productCounts.data?.all ?? null}
            toggling={toggling !== null}
            onEdit={open}
            onToggle={(label, isActive) => void toggle(label, isActive)}
          />
        </DictionaryLayout>
      </ListPageBody>

      <CatalogEditorModal
        icon={current ? LABEL_ICONS[current.kind] : IconTag}
        opened={drawer.opened}
        onClose={drawer.close}
        dirty={drawer.dirty}
        title={current ? `Мітка «${current.name}»` : 'Нова мітка'}
        size="compact"
        className="label-editor-modal"
        closeOnEscape={!drawer.busy && !drawer.confirming}
        closeOnClickOutside={!drawer.busy && !drawer.confirming}
        footer={<EditorDrawerFooter formId={FORM_ID} busy={drawer.busy} onCancel={drawer.close} onDelete={deletable ? () => drawer.setConfirming(true) : undefined} />}
      >
        {drawer.editing ? (
          <LabelForm
            key={drawer.editing.key}
            formId={FORM_ID}
            label={drawer.editing.item}
            nextSortOrder={nextSortOrder}
            error={drawer.actionError}
            onBusy={drawer.setBusy}
            onSaved={saved}
            onDirty={drawer.setDirty}
          />
        ) : null}
      </CatalogEditorModal>

      <ConfirmDialog
        opened={drawer.confirming}
        title="Видалити мітку"
        message={
          current
            ? current.kind === 'manual' && current.productCount
              ? `Мітка «${current.name}» зникне з товарів (${current.productCount}) і з довідника. Скасувати видалення не можна.`
              : `Мітка «${current.name}» зникне з довідника. Скасувати видалення не можна.`
            : ''
        }
        confirmLabel="Видалити мітку"
        danger
        busy={drawer.busy}
        onConfirm={() => void remove()}
        onClose={() => drawer.setConfirming(false)}
      />
    </ListPage>
  )
}
