import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useCallback, useState } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
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
import { deleteCollection, getCollections, type ConsoleCollection } from '../api/catalogApi'
import { CollectionForm } from '../components/CollectionForm'
import '../components/catalog.css'

const FORM_ID = 'catalog-collection-form'
const getRowId = (row: ConsoleCollection) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

const columns: DataTableColumn<ConsoleCollection>[] = [
  {
    id: 'title',
    header: 'Добірка',
    width: 320,
    fill: true,
    cell: (row) => <CellStack title={row.title} sub={<span className="catalog-code">{row.code}</span>} />,
  },
  { id: 'products', header: 'Товарів', width: 110, align: 'right', numeric: true, cell: (row) => <NumberValue value={row.products.length} /> },
  {
    id: 'visible',
    header: 'На головній',
    width: 150,
    cell: (row) => (row.isVisible ? <TableChip tone="success" dot value="Показується" /> : <TableChip value="Прихована" />),
  },
  { id: 'sortOrder', header: 'Порядок', width: 110, align: 'right', numeric: true, cell: (row) => <NumberValue value={row.sortOrder} /> },
]

type Editing = { collection: ConsoleCollection | null; key: number }

export function CollectionsPage() {
  const collections = useApiQuery('catalog-collections', () => getCollections())
  const [editing, setEditing] = useState<Editing | null>(null)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const open = useCallback((collection: ConsoleCollection | null) => {
    setDeleteError(null)
    setEditing({ collection, key: Date.now() })
    setOpened(true)
  }, [])

  function close() {
    if (busy) return
    setOpened(false)
  }

  function saved() {
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
  const emptyText =
    collections.status === 'error' ? (
      <Stack align="center" gap={8}>
        <Text size="sm">{problemMessage(collections.problem, 'Не вдалося завантажити добірки.')}</Text>
        <Button size="xs" variant="default" onClick={collections.reload}>
          Спробувати ще раз
        </Button>
      </Stack>
    ) : (
      'Добірок ще немає. Головна покаже лише категорії й знижки.'
    )

  return (
    <ListPage>
      <PageHeader
        title="Добірки"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
            Нова добірка
          </Button>
        }
      />

      <FilterBar
        actions={
          <>
            {collections.data ? <span className="app-filter-summary catalog-summary">Добірок: {countFormat.format(collections.data.length)}</span> : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={collections.isFetching} onClick={collections.reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      />

      <ListPageBody>
        <DataTable
          ariaLabel="Добірки"
          columns={columns}
          data={collections.status === 'error' ? [] : (collections.data ?? [])}
          getRowId={getRowId}
          isLoading={collections.isLoading}
          isFetching={collections.isFetching}
          minWidth={720}
          height="100%"
          manualSorting
          onRowClick={open}
          emptyText={emptyText}
        />
      </ListPageBody>

      <AppDrawer
        opened={opened}
        onClose={close}
        title={current ? `Добірка «${current.title}»` : 'Нова добірка'}
        size="compact"
        closeOnEscape={!busy}
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
              <Button variant="default" disabled={busy} onClick={close}>
                Скасувати
              </Button>
              <Button type="submit" form={FORM_ID} loading={busy}>
                Зберегти добірку
              </Button>
            </Group>
          </Group>
        }
      >
        {editing ? <CollectionForm key={editing.key} formId={FORM_ID} collection={editing.collection} error={deleteError} onBusy={setBusy} onSaved={saved} /> : null}
      </AppDrawer>

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
