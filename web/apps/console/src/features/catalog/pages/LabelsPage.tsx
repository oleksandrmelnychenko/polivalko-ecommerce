import { ActionIcon, Button, Switch, Tooltip } from '@mantine/core'
import { IconPencil, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { NumberValue } from '@/shared/ui/Money'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { deleteLabel, getLabels, saveLabel, type ProductLabel } from '../api/dictionariesApi'
import { EditorDrawerFooter } from '../components/EditorDrawerFooter'
import { LabelChip } from '../components/LabelChip'
import { LabelForm } from '../components/LabelForm'
import { listEmptyText } from '../components/ListEmpty'
import { canDeleteLabel, isAutoLabel, LABEL_KIND_LABELS, labelRule, sortLabels } from '../lib/labels'
import { useEditorDrawer } from '../lib/useEditorDrawer'
import '../components/catalog.css'
import '../components/catalog-dictionaries.css'

const FORM_ID = 'catalog-label-form'
const getRowId = (row: ProductLabel) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function LabelsPage() {
  const labels = useApiQuery('catalog-labels', () => getLabels())
  const drawer = useEditorDrawer<ProductLabel>()
  const { open, current } = drawer
  const [toggling, setToggling] = useState<string | null>(null)

  const rows = useMemo(() => sortLabels(labels.data ?? []), [labels.data])
  const nextSortOrder = rows.length ? Math.max(...rows.map((row) => row.sortOrder)) + 10 : 10
  const { reload, setData } = labels

  const columns = useMemo<DataTableColumn<ProductLabel>[]>(() => {
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

    return [
      {
        id: 'preview',
        header: 'Мітка',
        width: 180,
        cell: (row) => <LabelChip name={row.name} tone={row.tone} muted={!row.isActive} />,
      },
      {
        id: 'kind',
        header: 'Як ставиться',
        width: 140,
        cell: (row) => <TableChip tone={isAutoLabel(row) ? 'document' : 'neutral'} value={LABEL_KIND_LABELS[row.kind] ?? row.kind} />,
      },
      { id: 'rule', header: 'Правило', width: 320, fill: true, cell: (row) => <span className="catalog-rule-text">{labelRule(row)}</span> },
      {
        id: 'products',
        header: 'Товарів',
        width: 100,
        align: 'right',
        numeric: true,
        cell: (row) =>
          row.productCount ? (
            <Link className="catalog-link" to={`/catalog/products?labelId=${encodeURIComponent(row.id)}`}>
              {countFormat.format(row.productCount)}
            </Link>
          ) : (
            <NumberValue value={0} />
          ),
      },
      { id: 'sortOrder', header: 'Порядок', width: 96, align: 'right', numeric: true, cell: (row) => <NumberValue value={row.sortOrder} /> },
      {
        id: 'active',
        header: 'На сайті',
        width: 104,
        cell: (row) => (
          <Switch
            size="sm"
            checked={row.isActive}
            disabled={toggling !== null}
            aria-label={`${row.isActive ? 'Вимкнути' : 'Увімкнути'} «${row.name}»`}
            onChange={(event) => void toggle(row, event.currentTarget.checked)}
          />
        ),
      },
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
    ]
  }, [open, reload, toggling])

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
        <DataTable
          ariaLabel="Мітки товарів"
          columns={columns}
          data={labels.status === 'error' || labels.status === 'forbidden' ? [] : rows}
          getRowId={getRowId}
          isLoading={labels.isLoading}
          isFetching={labels.isFetching}
          minWidth={920}
          height="100%"
          manualSorting
          onRowClick={open}
          emptyText={listEmptyText(labels, 'Не вдалося завантажити мітки.', 'Міток ще немає.')}
        />
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
