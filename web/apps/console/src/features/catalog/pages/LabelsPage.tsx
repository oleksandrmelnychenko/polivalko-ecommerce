import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconPlus, IconRefresh } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getProductCounts } from '../api/catalogApi'
import { deleteLabel, getLabels, saveLabel, type ProductLabel } from '../api/dictionariesApi'
import { EditorDrawerFooter } from '../components/EditorDrawerFooter'
import { LabelChip } from '../components/LabelChip'
import { LabelDetailPane } from '../components/LabelDetailPane'
import { LabelForm } from '../components/LabelForm'
import { listEmptyText } from '../components/ListEmpty'
import { canDeleteLabel, isAutoLabel, sortLabels } from '../lib/labels'
import { useEditorDrawer } from '../lib/useEditorDrawer'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '../components/catalog-dictionaries.css'
import '../components/catalog-split.css'

const FORM_ID = 'catalog-label-form'
const getRowId = (row: ProductLabel) => row.id
const SELECT_KEYS = ['id'] as const
const countFormat = new Intl.NumberFormat('uk-UA')

export function LabelsPage() {
  const labels = useApiQuery('catalog-labels', () => getLabels())
  const drawer = useEditorDrawer<ProductLabel>()
  const { open, current } = drawer
  const [toggling, setToggling] = useState<string | null>(null)

  const rows = useMemo(() => sortLabels(labels.data ?? []), [labels.data])
  const nextSortOrder = rows.length ? Math.max(...rows.map((row) => row.sortOrder)) + 10 : 10
  const { reload, setData } = labels

  const { values: picked, set: pick } = useListParams(SELECT_KEYS)
  const selected = rows.find((row) => row.id === picked.id) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null
  const productCounts = useApiQuery('catalog-products-counts', () => getProductCounts())
  const selectRow = useCallback((row: ProductLabel) => pick({ id: row.id }), [pick])
  const rowClassName = useCallback((row: ProductLabel) => (row.id === selectedId ? 'catalog-split-row-active' : undefined), [selectedId])

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
        cell: (row) => <LabelChip name={row.name} tone={row.tone} muted={!row.isActive} />,
      },
      {
        id: 'kind',
        header: 'Як ставиться',
        width: 150,
        cell: (row) => (
          <span className={row.isActive ? 'catalog-split-item-meta' : 'catalog-split-item-meta is-off'}>
            {isAutoLabel(row) ? 'автоматично' : 'вручну'}
            {row.isActive ? '' : ', вимкнена'}
          </span>
        ),
      },
      {
        id: 'products',
        header: 'Товарів',
        width: 100,
        align: 'right',
        numeric: true,
        cell: (row) =>
          row.productCount ? (
            <span className="catalog-split-item-count">{countFormat.format(row.productCount)}</span>
          ) : (
            <span className="catalog-split-item-meta is-off">0</span>
          ),
      },
    ],
    [],
  )

  function saved() {
    drawer.setOpened(false)
    notifySuccess('Мітку збережено. Вітрина оновиться протягом хвилини.')
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
        setData(rows.filter((row) => row.id !== current.id))
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
    <ListPage>
      <PageHeader
        title="Мітки"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
            Нова мітка
          </Button>
        }
      />

      <FilterBar
        actions={
          <>
            {labels.data ? <span className="app-filter-summary catalog-summary">Міток: {countFormat.format(rows.length)}</span> : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={labels.isFetching} onClick={reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      />

      <ListPageBody>
        <div className="catalog-split-layout">
          <div className="catalog-split-list">
            <DataTable
              ariaLabel="Мітки товарів"
              columns={columns}
              data={labels.status === 'error' || labels.status === 'forbidden' ? [] : rows}
              getRowId={getRowId}
              isLoading={labels.isLoading}
              isFetching={labels.isFetching}
              minWidth={420}
              height="100%"
              manualSorting
              onRowClick={selectRow}
              rowClassName={rowClassName}
              emptyText={listEmptyText(labels, 'Не вдалося завантажити мітки.', 'Міток ще немає.')}
            />
          </div>
          <LabelDetailPane
            label={selected}
            totalProducts={productCounts.data?.all ?? null}
            toggling={toggling !== null}
            onEdit={open}
            onToggle={(label, isActive) => void toggle(label, isActive)}
          />
        </div>
      </ListPageBody>

      <AppDrawer
        opened={drawer.opened}
        onClose={drawer.close}
        title={current ? `Мітка «${current.name}»` : 'Нова мітка'}
        size="compact"
        closeOnEscape={!drawer.busy}
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
          />
        ) : null}
      </AppDrawer>

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
