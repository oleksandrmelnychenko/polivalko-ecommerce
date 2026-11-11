import { ActionIcon, Button, CloseButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconPlus, IconRefresh, IconSearch, IconTrash } from '@tabler/icons-react'
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
import { notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { deleteCategory, getCategories, type ConsoleCategory } from '../api/catalogApi'
import { getAttributes } from '../api/dictionariesApi'
import { CategoryDetailPane } from '../components/CategoryDetailPane'
import { CategoryForm } from '../components/CategoryForm'
import { ProductThumb } from '../components/ProductThumb'
import { isHidden, orderCategories, type OrderedCategory } from '../lib/categoryTree'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '../components/catalog-split.css'

const FORM_ID = 'catalog-category-form'
const getRowId = (row: OrderedCategory) => row.id
const SELECT_KEYS = ['id'] as const
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
    notifySuccess('Категорію збережено.')
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

  const { values: picked, set: pick } = useListParams(SELECT_KEYS)
  const selected = rows.find((row) => row.id === picked.id) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null
  const selectCategory = useCallback((id: string) => pick({ id }), [pick])
  const selectRow = useCallback((row: OrderedCategory) => pick({ id: row.id }), [pick])
  const inherits = useMemo(() => {
    const byId = new Map(all.map((item) => [item.id, item]))
    const ids = new Set<string>()
    for (const item of all) {
      if (item.filterAttributes.length) continue
      for (let parent = item.parentId ? byId.get(item.parentId) : undefined, depth = 0; parent && depth < 10; parent = parent.parentId ? byId.get(parent.parentId) : undefined, depth++) {
        if (parent.filterAttributes.length) {
          ids.add(item.id)
          break
        }
      }
    }
    return ids
  }, [all])
  const rowClassName = useCallback((row: OrderedCategory) => (row.id === selectedId ? 'catalog-split-row-active' : undefined), [selectedId])

  const columns = useMemo<DataTableColumn<OrderedCategory>[]>(
    () => [
      {
        id: 'name',
        header: 'Категорія',
        width: 280,
        minWidth: 200,
        fill: true,
        cell: (row) => (
          <span className="catalog-tree-cell" style={{ paddingLeft: row.depth * 20 }}>
            {row.depth > 0 ? <span className="catalog-tree-branch" aria-hidden="true" /> : null}
            <ProductThumb url={row.imageUrl} size={28} />
            <span className="catalog-split-item-name">{row.name}</span>
            {isHidden(row) ? <TableChip value="прихована" title={row.isVisible ? 'Прихована батьківська категорія' : undefined} /> : null}
          </span>
        ),
      },
      {
        id: 'filters',
        header: 'Фільтри',
        width: 130,
        cell: (row) =>
          row.filterAttributes.length ? (
            <span className="catalog-split-item-meta">{row.filterAttributes.length}</span>
          ) : (
            <span className="catalog-split-item-meta is-off">{inherits.has(row.id) ? 'успадковані' : 'немає'}</span>
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
    [inherits],
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
        <div className="catalog-split-layout">
          <div className="catalog-split-list">
            <DataTable
              ariaLabel="Категорії каталогу"
              columns={columns}
              data={categories.status === 'error' ? [] : rows}
              getRowId={getRowId}
              isLoading={categories.isLoading}
              isFetching={categories.isFetching}
              minWidth={460}
              height="100%"
              manualSorting
              onRowClick={selectRow}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <CategoryDetailPane
            category={selected}
            all={all}
            attributes={attributes.status === 'ready' ? (attributes.data ?? null) : null}
            onEdit={open}
            onSelect={selectCategory}
          />
        </div>
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
                Зберегти категорію
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
        message={current ? `Категорія «${current.name}» зникне з каталогу. Скасувати видалення не можна.` : ''}
        confirmLabel="Видалити категорію"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setConfirming(false)}
      />
    </ListPage>
  )
}
