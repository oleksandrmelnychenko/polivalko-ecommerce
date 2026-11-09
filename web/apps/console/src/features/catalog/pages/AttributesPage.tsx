import { ActionIcon, Button, Select, Tooltip } from '@mantine/core'
import { IconFilterOff, IconPencil, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useMemo } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemCode, problemMessage, type Problem } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { CellStack, NumberValue } from '@/shared/ui/Money'
import { notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { deleteAttribute, getAttributes, type AttributeDefinition } from '../api/dictionariesApi'
import { AttributeForm } from '../components/AttributeForm'
import { EditorDrawerFooter } from '../components/EditorDrawerFooter'
import { listEmptyText } from '../components/ListEmpty'
import { ListSearch } from '../components/ListSearch'
import { ATTRIBUTE_KIND_LABELS, ATTRIBUTE_KIND_OPTIONS, FILTER_VIEW_LABELS, matchesAttribute, sortAttributes } from '../lib/attributes'
import { useEditorDrawer } from '../lib/useEditorDrawer'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '../components/catalog-dictionaries.css'

const FORM_ID = 'catalog-attribute-form'
const PARAM_KEYS = ['q', 'kind', 'usage'] as const
const USAGE_OPTIONS = [
  { value: 'filters', label: 'Є фільтром' },
  { value: 'unused', label: 'Без товарів' },
]
const getRowId = (row: AttributeDefinition) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

function deleteProblemText(error: unknown): string {
  const problem = error as Problem | undefined
  if (problemCode(problem) === 'attributes.in_filters') {
    const count = Number(problem?.categoryCount)
    const where = Number.isFinite(count) && count > 0 ? ` у категоріях (${count})` : ''
    return `Характеристика є фільтром${where}. Спершу приберіть її з фільтрів категорій, потім видаліть.`
  }
  return problemMessage(problem, 'Характеристику не видалено.')
}

export function AttributesPage() {
  const attributes = useApiQuery('catalog-attributes', () => getAttributes())
  const { values, set, reset } = useListParams(PARAM_KEYS)
  const drawer = useEditorDrawer<AttributeDefinition>()
  const { open, current } = drawer

  const all = useMemo(() => sortAttributes(attributes.data ?? []), [attributes.data])
  const rows = useMemo(
    () =>
      all.filter(
        (row) =>
          matchesAttribute(row, values.q) &&
          (!values.kind || row.kind === values.kind) &&
          (values.usage !== 'filters' || row.categoryCount > 0) &&
          (values.usage !== 'unused' || row.productCount === 0),
      ),
    [all, values.kind, values.q, values.usage],
  )
  const filtered = Boolean(values.q || values.kind || values.usage)
  const nextSortOrder = all.length ? Math.max(...all.map((row) => row.sortOrder)) + 10 : 10

  const columns = useMemo<DataTableColumn<AttributeDefinition>[]>(
    () => [
      {
        id: 'name',
        header: 'Характеристика',
        width: 240,
        minWidth: 200,
        fill: true,
        accessor: (row) => row.name,
        cell: (row) => <CellStack title={row.name} sub={row.unit ? <span className="catalog-code">{row.unit}</span> : undefined} />,
      },
      { id: 'kind', header: 'Тип', width: 110, accessor: (row) => ATTRIBUTE_KIND_LABELS[row.kind], cell: (row) => ATTRIBUTE_KIND_LABELS[row.kind] ?? row.kind },
      {
        id: 'filterView',
        header: 'У фільтрі',
        width: 120,
        cell: (row) => <TableChip tone={row.filterView === 'range' ? 'document' : 'neutral'} value={FILTER_VIEW_LABELS[row.filterView] ?? row.filterView} />,
      },
      {
        id: 'aliases',
        header: 'Синоніми',
        width: 220,
        cell: (row) =>
          row.aliases.length ? (
            <span className="catalog-ellipsis" title={row.aliases.join(', ')}>
              {row.aliases.join(', ')}
            </span>
          ) : (
            <span className="catalog-muted">немає</span>
          ),
      },
      { id: 'products', header: 'Товарів', width: 100, align: 'right', numeric: true, sortDescFirst: true, accessor: (row) => row.productCount, cell: (row) => <NumberValue value={row.productCount} /> },
      {
        id: 'categories',
        header: 'Фільтр у категоріях',
        width: 160,
        align: 'right',
        numeric: true,
        sortDescFirst: true,
        accessor: (row) => row.categoryCount,
        cell: (row) => (row.categoryCount ? <NumberValue value={row.categoryCount} /> : <span className="catalog-muted">немає</span>),
      },
      { id: 'sortOrder', header: 'Порядок', width: 96, align: 'right', numeric: true, accessor: (row) => row.sortOrder, cell: (row) => <NumberValue value={row.sortOrder} /> },
      {
        id: 'edit',
        header: <span className="visually-hidden">Дія</span>,
        width: 56,
        align: 'center',
        cell: (row) => (
          <Tooltip label="Змінити">
            <ActionIcon variant="subtle" color="gray" aria-label={`Змінити «${row.name}»`} onClick={() => open(row)}>
              <IconPencil size={16} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [open],
  )

  function saved(next: AttributeDefinition | undefined) {
    drawer.setOpened(false)
    notifySuccess(next && current && next.name !== current.name ? `Характеристику перейменовано на «${next.name}».` : 'Характеристику збережено.')
    attributes.reload()
  }

  async function remove() {
    if (!current) return
    drawer.setBusy(true)
    try {
      const result = await withCsrf((headers) => deleteAttribute(headers, current.id))
      drawer.setConfirming(false)
      if (result.response.ok) {
        drawer.setOpened(false)
        notifySuccess(`Характеристику «${current.name}» видалено з довідника.`)
        attributes.reload()
      } else {
        drawer.setActionError(deleteProblemText(result.error))
      }
    } catch {
      drawer.setConfirming(false)
      drawer.setActionError(NETWORK_ERROR)
    }
    drawer.setBusy(false)
  }

  return (
    <ListPage>
      <PageHeader
        title="Характеристики"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
            Нова характеристика
          </Button>
        }
      />

      <FilterBar
        activeCount={[values.kind, values.usage].filter(Boolean).length}
        search={<ListSearch value={values.q} placeholder="Назва або синонім…" onChange={(q) => set({ q })} />}
        actions={
          <>
            {filtered ? (
              <Tooltip label="Скинути">
                <ActionIcon variant="default" aria-label="Скинути фільтри" onClick={reset}>
                  <IconFilterOff size={17} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {attributes.data ? (
              <span className="app-filter-summary catalog-summary">
                {filtered ? `Знайдено: ${countFormat.format(rows.length)} з ${countFormat.format(all.length)}` : `Характеристик: ${countFormat.format(all.length)}`}
              </span>
            ) : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={attributes.isFetching} onClick={attributes.reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      >
        <Select label="Тип" placeholder="Усі типи" data={ATTRIBUTE_KIND_OPTIONS} value={values.kind || null} clearable onChange={(kind) => set({ kind })} />
        <Select label="Використання" placeholder="Усі" data={USAGE_OPTIONS} value={values.usage || null} clearable onChange={(usage) => set({ usage })} />
      </FilterBar>

      <ListPageBody>
        <DataTable
          ariaLabel="Довідник характеристик"
          columns={columns}
          data={attributes.status === 'error' || attributes.status === 'forbidden' ? [] : rows}
          getRowId={getRowId}
          isLoading={attributes.isLoading}
          isFetching={attributes.isFetching}
          minWidth={1000}
          height="100%"
          onRowClick={open}
          emptyText={listEmptyText(
            attributes,
            'Не вдалося завантажити характеристики.',
            filtered ? 'Нічого не знайдено.' : 'Довідник порожній. Додайте першу характеристику.',
          )}
        />
      </ListPageBody>

      <AppDrawer
        opened={drawer.opened}
        onClose={drawer.close}
        title={current ? `Характеристика «${current.name}»` : 'Нова характеристика'}
        size="compact"
        closeOnEscape={!drawer.busy}
        footer={<EditorDrawerFooter formId={FORM_ID} busy={drawer.busy} onCancel={drawer.close} onDelete={current ? () => drawer.setConfirming(true) : undefined} />}
      >
        {drawer.editing ? (
          <AttributeForm
            key={drawer.editing.key}
            formId={FORM_ID}
            attribute={drawer.editing.item}
            nextSortOrder={nextSortOrder}
            error={drawer.actionError}
            onBusy={drawer.setBusy}
            onSaved={saved}
          />
        ) : null}
      </AppDrawer>

      <ConfirmDialog
        opened={drawer.confirming}
        title="Видалити характеристику"
        message={
          current
            ? `«${current.name}» зникне з довідника.${current.productCount ? ` Значення в товарах (${current.productCount}) залишаться.` : ''} Скасувати видалення не можна.`
            : ''
        }
        confirmLabel="Видалити характеристику"
        danger
        busy={drawer.busy}
        onConfirm={() => void remove()}
        onClose={() => drawer.setConfirming(false)}
      />
    </ListPage>
  )
}
