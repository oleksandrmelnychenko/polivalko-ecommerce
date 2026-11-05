import { ActionIcon, Button, CloseButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconPencil, IconPlus, IconRefresh, IconSearch, IconTrash } from '@tabler/icons-react'
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
import { NumberValue } from '@/shared/ui/Money'
import { notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { deleteCategory, getCategories, type ConsoleCategory } from '../api/catalogApi'
import { getAttributes } from '../api/dictionariesApi'
import { CategoryForm } from '../components/CategoryForm'
import { ProductThumb } from '../components/ProductThumb'
import { isHidden, orderCategories, type OrderedCategory } from '../lib/categoryTree'
import '../components/catalog.css'

const FORM_ID = 'catalog-category-form'
const getRowId = (row: OrderedCategory) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

type Editing = { category: ConsoleCategory | null; key: number }

export function CategoriesPage() {
  const categories = useApiQuery('catalog-categories', () => getCategories())
  const attributes = useApiQuery('catalog-attributes', () => getAttributes())
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const all = useMemo(() => categories.data ?? [], [categories.data])
  const ordered = useMemo(() => orderCategories(all), [all])
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return ordered
    return ordered.filter((c) => [c.name, c.slug, c.navkoloRef ?? ''].some((value) => value.toLowerCase().includes(term)))
  }, [ordered, search])

  const open = useCallback((category: ConsoleCategory | null) => {
    setDeleteError(null)
    setEditing({ category, key: Date.now() })
    setOpened(true)
  }, [])

  function close() {
    if (busy) return
    setOpened(false)
  }

  function saved() {
    setOpened(false)
    notifySuccess('Збережено.')
    categories.reload()
  }

  async function remove() {
    const category = editing?.category
    if (!category) return
    setBusy(true)
    try {
      const result = await withCsrf((headers) => deleteCategory(headers, category.id))
      if (result.response.ok) {
        setConfirming(false)
        setOpened(false)
        notifySuccess(`Категорію «${category.name}» видалено.`)
        categories.reload()
      } else {
        setConfirming(false)
        setDeleteError(problemMessage(result.error, 'Категорію не видалено.'))
      }
    } catch {
      setConfirming(false)
      setDeleteError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  const columns = useMemo<DataTableColumn<OrderedCategory>[]>(
    () => [
      {
        id: 'name',
        header: 'Категорія',
        width: 300,
        minWidth: 220,
        fill: true,
        cell: (row) => (
          <span className="catalog-tree-cell" style={{ paddingLeft: row.depth * 20 }}>
            {row.depth > 0 ? <span className="catalog-tree-branch" aria-hidden="true" /> : null}
            <ProductThumb url={row.imageUrl} size={32} />
            <span className="app-cell-stack">
              <span className="app-cell-title catalog-tree-title">
                {row.name}
                {isHidden(row) ? <TableChip value="прихована" title={row.isVisible ? 'Прихована батьківська категорія' : undefined} /> : null}
              </span>
              <span className="app-cell-sub catalog-code">/catalog/{row.slug}</span>
            </span>
          </span>
        ),
      },
      {
        id: 'navkoloRef',
        header: 'Група Navkolo',
        width: 220,
        cell: (row) => (row.navkoloRef ? <span className="catalog-ellipsis">{row.navkoloRef}</span> : <span className="catalog-muted">не задано</span>),
      },
      {
        id: 'filters',
        header: 'Фільтри',
        width: 260,
        cell: (row) =>
          row.filterAttributes.length ? (
            <span className="catalog-ellipsis" title={row.filterAttributes.join(', ')}>
              {row.filterAttributes.join(', ')}
            </span>
          ) : (
            <span className="catalog-muted">успадковані</span>
          ),
      },
      { id: 'products', header: 'Товарів', width: 100, align: 'right', numeric: true, cell: (row) => <NumberValue value={row.productCount} /> },
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

  const current = editing?.category ?? null
  const canDelete = current !== null && Boolean(current.parentId)
  const emptyText =
    categories.status === 'error' ? (
      <Stack align="center" gap={8}>
        <Text size="sm">{problemMessage(categories.problem, 'Не вдалося завантажити категорії.')}</Text>
        <Button size="xs" variant="default" onClick={categories.reload}>
          Спробувати ще раз
        </Button>
      </Stack>
    ) : search ? (
      'Нічого не знайдено.'
    ) : (
      'Категорій ще немає.'
    )

  return (
    <ListPage>
      <PageHeader
        title="Категорії"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
            Нова підкатегорія
          </Button>
        }
      />

      <FilterBar
        search={
          <TextInput
            className="app-filter-wide"
            label="Пошук"
            placeholder="Назва, адреса або група Navkolo…"
            value={search}
            leftSection={<IconSearch size={16} stroke={1.7} />}
            rightSection={search ? <CloseButton size="sm" aria-label="Очистити пошук" onClick={() => setSearch('')} /> : null}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        }
        actions={
          <>
            {categories.data ? <span className="app-filter-summary catalog-summary">Категорій: {countFormat.format(categories.data.length)}</span> : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={categories.isFetching} onClick={categories.reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      />

      <ListPageBody>
        <DataTable
          ariaLabel="Категорії каталогу"
          columns={columns}
          data={categories.status === 'error' ? [] : rows}
          getRowId={getRowId}
          isLoading={categories.isLoading}
          isFetching={categories.isFetching}
          minWidth={940}
          height="100%"
          manualSorting
          onRowClick={open}
          emptyText={emptyText}
        />
      </ListPageBody>

      <AppDrawer
        opened={opened}
        onClose={close}
        title={current ? `Категорія «${current.name}»` : 'Нова підкатегорія'}
        size="compact"
        closeOnEscape={!busy}
        footer={
          <Group justify="space-between" w="100%">
            {canDelete ? (
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
                Зберегти
              </Button>
            </Group>
          </Group>
        }
      >
        {editing ? <CategoryForm
            key={editing.key}
            formId={FORM_ID}
            category={editing.category}
            all={all}
            attributes={attributes.status === 'ready' ? (attributes.data ?? null) : null}
            error={deleteError}
            onBusy={setBusy}
            onSaved={saved}
          /> : null}
      </AppDrawer>

      <ConfirmDialog
        opened={confirming}
        title="Видалити категорію"
        message={current ? `Категорію «${current.name}» буде видалено.` : ''}
        confirmLabel="Видалити"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirming(false)}
      />
    </ListPage>
  )
}
