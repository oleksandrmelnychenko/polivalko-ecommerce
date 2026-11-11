import { Button } from '@mantine/core'
import { IconFileImport } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Can, usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifyInfo, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { bulkUpdateProducts, getCategories, getProductCounts, getProducts, setProductsVisibility, type BulkProductsRequest, type ProductRow } from '../api/catalogApi'
import { getBrands, getLabels } from '../api/dictionariesApi'
import { listEmptyText } from '../components/ListEmpty'
import { ProductsBulkBar } from '../components/ProductsBulkBar'
import { NO_BRAND, ProductsBulkDialog, type BulkAction } from '../components/ProductsBulkDialog'
import { productsColumns } from '../components/productsColumns'
import { ProductsFilters } from '../components/ProductsFilters'
import { ProductsTabs } from '../components/ProductsTabs'
import { ProductsTiles } from '../components/ProductsTiles'
import { ProductsViewToggle } from '../components/ProductsViewToggle'
import { consoleCategoryOptions } from '../lib/categoryTree'
import { manualLabelOptions, sortLabels } from '../lib/labels'
import { activeTab, hasActiveFilters, productHref, tabPatch, toProductsQuery, type ProductsTab } from '../lib/productFilters'
import { useProductsState } from '../lib/useProductsState'
import { useProductsView } from '../lib/useProductsView'
import '../components/catalog.css'

const getRowId = (row: ProductRow) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')
const EMPTY_SELECTION: ReadonlySet<string> = new Set()

const BULK_DONE: Record<BulkAction, string> = {
  category: 'Категорію змінено',
  brand: 'Бренд змінено',
  addLabel: 'Мітку додано',
  removeLabel: 'Мітку знято',
}

function bulkBody(action: BulkAction, value: string, productIds: string[]): BulkProductsRequest {
  return {
    productIds,
    categoryId: action === 'category' ? value : null,
    brand: action === 'brand' ? (value === NO_BRAND ? '' : value) : null,
    addLabelIds: action === 'addLabel' ? [value] : null,
    removeLabelIds: action === 'removeLabel' ? [value] : null,
    isVisible: null,
  }
}

export function ProductsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { state, params, update, reset } = useProductsState()
  const [view, setView] = useProductsView()
  const query = useMemo(() => toProductsQuery(state), [state])
  const products = useApiQuery(`catalog-products:${JSON.stringify(query)}`, () => getProducts(query))
  const counts = useApiQuery('catalog-products-counts', () => getProductCounts())
  const categoriesQuery = useApiQuery('catalog-categories', () => getCategories())
  const brandsQuery = useApiQuery('catalog-brands', () => getBrands())
  const labelsQuery = useApiQuery('catalog-labels', () => getLabels())
  const categories = useMemo(() => consoleCategoryOptions(categoriesQuery.data ?? []), [categoriesQuery.data])
  const brandOptions = useMemo(
    () =>
      brandsQuery.status === 'ready' && brandsQuery.data
        ? [...brandsQuery.data].sort((a, b) => a.name.localeCompare(b.name, 'uk')).map((brand) => ({ value: brand.name, label: brand.name }))
        : null,
    [brandsQuery.data, brandsQuery.status],
  )
  const labelFilterOptions = useMemo(
    () =>
      labelsQuery.status === 'ready' && labelsQuery.data
        ? sortLabels(labelsQuery.data).map((label) => ({ value: label.id, label: label.isActive ? label.name : `${label.name} (вимкнена)` }))
        : null,
    [labelsQuery.data, labelsQuery.status],
  )
  const manualLabels = useMemo(() => (labelsQuery.status === 'ready' && labelsQuery.data ? manualLabelOptions(labelsQuery.data) : null), [labelsQuery.data, labelsQuery.status])
  const filtered = hasActiveFilters(state)
  const canEdit = can(PermissionKeys.Catalog.EditProducts)
  const tab = activeTab(state)

  const selectionKey = params.toString()
  const [selection, setSelection] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: selectionKey, ids: new Set() })
  const selected = selection.key === selectionKey ? selection.ids : EMPTY_SELECTION
  const [pending, setPending] = useState<boolean | null>(null)
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const onRowClick = useCallback((row: ProductRow) => navigate(productHref(row.id)), [navigate])
  const rowLabels = useMemo(() => new Map((products.data?.items ?? []).map((row) => [row.id, row.displayName ?? row.name])), [products.data])
  const tableSelection = useMemo(
    () =>
      canEdit
        ? {
            selected,
            onChange: (ids: ReadonlySet<string>) => setSelection({ key: selectionKey, ids }),
            rowLabel: (id: string) => `Вибрати «${rowLabels.get(id) ?? id}»`,
          }
        : undefined,
    [canEdit, rowLabels, selected, selectionKey],
  )

  const page = products.data
  const rows = products.status === 'error' || products.status === 'forbidden' ? [] : (page?.items ?? [])

  function clearSelection() {
    setSelection({ key: selectionKey, ids: new Set() })
  }

  function reloadAll() {
    products.reload()
    counts.reload()
  }

  function changeTab(next: ProductsTab) {
    update(tabPatch(state, next))
  }

  async function setVisible(visible: boolean) {
    const productIds = [...selected]
    setPending(visible)
    try {
      const result = await withCsrf((headers) => setProductsVisibility(headers, { productIds, visible }))
      if (result.data) {
        clearSelection()
        if (result.data.updated === 0) notifyInfo(`Нічого не змінилося: вибрані товари вже ${visible ? 'показуються' : 'приховані'}.`)
        else notifySuccess(`${visible ? 'Показано на сайті' : 'Приховано з сайту'}: ${result.data.updated}.`)
        reloadAll()
      } else {
        notifyError(problemMessage(result.error, 'Не вдалося змінити видимість.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setPending(null)
  }

  function openBulk(action: BulkAction) {
    setBulkError(null)
    setBulkAction(action)
  }

  async function applyBulk(action: BulkAction, value: string) {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const result = await withCsrf((headers) => bulkUpdateProducts(headers, bulkBody(action, value, [...selected])))
      if (result.response.ok) {
        const updated = result.data?.updated ?? 0
        setBulkAction(null)
        clearSelection()
        if (updated === 0) notifyInfo('Нічого не змінилося: у вибраних товарах це вже так.')
        else notifySuccess(`${BULK_DONE[action]}: ${updated}.`)
        reloadAll()
      } else {
        setBulkError(problemMessage(result.error, 'Зміни не збережено.'))
      }
    } catch {
      setBulkError(NETWORK_ERROR)
    }
    setBulkBusy(false)
  }

  const emptyText = listEmptyText(products, 'Не вдалося завантажити товари.', 'Товарів за цими умовами немає.')

  return (
    <ListPage className="catalog-products-page">
      <PageHeader
        title="Товари"
        actions={
          <Can permission={PermissionKeys.Catalog.RunImport}>
            <Button component={Link} to="/catalog/import" variant="default" leftSection={<IconFileImport size={16} stroke={1.8} />}>
              Імпорт
            </Button>
          </Can>
        }
      />

      <ProductsTabs value={tab} counts={counts.status === 'ready' ? counts.data : undefined} onChange={changeTab} />

      <ProductsFilters
        state={state}
        categories={categories}
        brands={brandOptions}
        labels={labelFilterOptions}
        filtered={filtered}
        update={update}
        reset={reset}
        actions={
          <>
            <ProductsViewToggle value={view} onChange={setView} />
            {page ? <span className="app-filter-summary">Знайдено: {countFormat.format(page.totalItems)}</span> : null}
            <Paginator
              page={state.page}
              pageSize={state.pageSize}
              totalPages={page?.totalPages}
              isLoading={products.isFetching}
              onPageChange={(next) => update({ page: next })}
              onPageSizeChange={(size) => update({ pageSize: size })}
              onRefresh={reloadAll}
            />
          </>
        }
      />

      <ListPageBody>
        {view === 'tiles' ? (
          <ProductsTiles
            rows={rows}
            isLoading={products.isLoading}
            isFetching={products.isFetching}
            skeletons={state.pageSize}
            emptyText={emptyText}
            selection={tableSelection}
          />
        ) : (
          <DataTable
            ariaLabel="Товари"
            columns={productsColumns}
            data={rows}
            getRowId={getRowId}
            isLoading={products.isLoading}
            isFetching={products.isFetching}
            minWidth={1180}
            height="100%"
            manualSorting
            onRowClick={onRowClick}
            selection={tableSelection}
            emptyText={emptyText}
          />
        )}
      </ListPageBody>

      {selected.size > 0 ? (
        <ProductsBulkBar
          count={selected.size}
          pending={pending}
          canBrand={brandOptions !== null}
          canLabels={manualLabels !== null}
          onVisible={(visible) => void setVisible(visible)}
          onAction={openBulk}
          onClear={clearSelection}
        />
      ) : null}

      <ProductsBulkDialog
        action={bulkAction}
        count={selected.size}
        categories={categories}
        brands={brandOptions ? [{ value: NO_BRAND, label: 'Без бренду (прибрати бренд)' }, ...brandOptions] : []}
        labels={manualLabels ?? []}
        busy={bulkBusy}
        error={bulkError}
        onSubmit={(action, value) => void applyBulk(action, value)}
        onClose={() => {
          if (!bulkBusy) setBulkAction(null)
        }}
      />
    </ListPage>
  )
}
