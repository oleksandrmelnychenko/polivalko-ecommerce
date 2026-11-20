import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import { ScreenTabs } from '@/shared/ui/ScreenTabs'
import { IconPackage, IconPackageOff, IconPhotoOff, IconCertificate, IconArrowMerge, IconFilterOff, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemCode, problemMessage, type Problem } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { CatalogEditorModal } from '../components/CatalogEditorModal'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifySuccess } from '@/shared/ui/notify'
import { DictionaryLayout, DictionaryLink } from '../components/DictionaryLayout'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getProductCounts } from '../api/catalogApi'
import { deleteBrand, getBrands, type Brand } from '../api/dictionariesApi'
import { BrandDetailPane } from '../components/BrandDetailPane'
import { BrandForm } from '../components/BrandForm'
import { BrandMark } from '../components/BrandMark'
import { BrandMergeDialog } from '../components/BrandMergeDialog'
import { EditorDrawerFooter } from '../components/EditorDrawerFooter'
import { listEmptyText } from '../components/ListEmpty'
import { ListSearch } from '../components/ListSearch'
import { useEditorDrawer } from '../lib/useEditorDrawer'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '../components/catalog-dictionaries.css'
import '@/shared/ui/split/split.css'
import '../components/catalog-detail.css'
import '../components/catalog-brands.css'

const FORM_ID = 'catalog-brand-form'
const PARAM_KEYS = ['q', 'usage'] as const
const SELECT_KEYS = ['id'] as const
const USAGE_OPTIONS = [
  { value: '', label: 'Усі бренди', icon: IconCertificate },
  { value: 'used', icon: IconPackage, label: 'З товарами' },
  { value: 'unused', icon: IconPackageOff, label: 'Без товарів' },
  { value: 'no-logo', icon: IconPhotoOff, label: 'Без логотипа' },
] as const
const getRowId = (row: Brand) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

function deleteProblemText(error: unknown): string {
  const problem = error as Problem | undefined
  if (problemCode(problem) === 'brands.in_use') {
    const count = Number(problem?.productCount)
    const what = Number.isFinite(count) && count > 0 ? ` (товарів: ${count})` : ''
    return `Бренд має товари${what}. Об'єднайте його з іншим брендом або спершу змініть бренд у товарах.`
  }
  return problemMessage(problem, 'Бренд не видалено.')
}

export function BrandsPage() {
  const { can } = usePermissions()
  const brands = useApiQuery('catalog-brands', () => getBrands())
  const { values, set, reset } = useListParams(PARAM_KEYS)
  const drawer = useEditorDrawer<Brand>()
  const { open, current } = drawer
  const [merging, setMerging] = useState<Brand | null>(null)

  const all = useMemo(() => [...(brands.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'uk')), [brands.data])
  const compact = useMediaQuery('(max-width: 74em)')
  const usageCounts = useMemo(() => {
    const used = all.filter((brand) => brand.productCount > 0).length
    return { '': all.length, used, unused: all.length - used, 'no-logo': all.filter((brand) => !brand.logoUrl).length }
  }, [all])
  const rows = useMemo(() => {
    const term = values.q.toLowerCase()
    return all.filter(
      (row) =>
        (!term || row.name.toLowerCase().includes(term) || row.slug.toLowerCase().includes(term)) &&
        (values.usage !== 'used' || row.productCount > 0) &&
        (values.usage !== 'unused' || row.productCount === 0) &&
        (values.usage !== 'no-logo' || !row.logoUrl),
    )
  }, [all, values.q, values.usage])
  const filtered = Boolean(values.q || values.usage)

  const { values: picked, set: pick } = useListParams(SELECT_KEYS)
  const selected = rows.find((row) => row.id === picked.id) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null
  const productCounts = useApiQuery('catalog-products-counts', () => getProductCounts(), { enabled: can(PermissionKeys.Catalog.ViewProducts) })
  const selectBrand = useCallback((row: Brand) => pick({ id: row.id }), [pick])
  const rowClassName = useCallback((row: Brand) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  const columns = useMemo<DataTableColumn<Brand>[]>(
    () => {
      const columns: DataTableColumn<Brand>[] = [
        {
          id: 'name',
          header: 'Бренд',
          width: compact ? 168 : 210,
          minWidth: 132,
          fill: true,
          accessor: (row) => row.name,
          cell: (row) => (
            <DictionaryLink id={row.id}>
              <BrandMark name={row.name} logoUrl={row.logoUrl} />
              <span className="brand-row-text">
                <span className="app-split-item-name">{row.name}</span>
                {compact && <small>{row.slug}</small>}
              </span>
            </DictionaryLink>
          ),
        },
        {
          id: 'slug',
          header: 'Адреса',
          width: 146,
          accessor: (row) => row.slug,
          cell: (row) => <span className="app-split-code">{row.slug}</span>,
        },
        {
          id: 'products',
          header: 'Товарів',
          width: 96,
          align: 'right',
          numeric: true,
          sortDescFirst: true,
          accessor: (row) => row.productCount,
          cell: (row) => <span className="app-split-item-count">{countFormat.format(row.productCount)}</span>,
        },
      ]
      return compact ? columns.filter((column) => column.id !== 'slug') : columns
    },
    [compact],
  )

  function saved(next: Brand | undefined) {
    drawer.setOpened(false)
    notifySuccess(next && current && next.name !== current.name && current.productCount > 0 ? `Бренд перейменовано на «${next.name}», товарів: ${current.productCount}.` : 'Бренд збережено.')
    if (next) pick({ id: next.id })
    brands.reload()
  }

  function merged(source: Brand, target: Brand) {
    setMerging(null)
    drawer.setOpened(false)
    notifySuccess(`«${source.name}» об'єднано з «${target.name}».`)
    pick({ id: target.id })
    brands.reload()
  }

  async function remove() {
    if (!current) return
    drawer.setBusy(true)
    try {
      const result = await withCsrf((headers) => deleteBrand(headers, current.id))
      drawer.setConfirming(false)
      if (result.response.ok) {
        drawer.setOpened(false)
        notifySuccess(`Бренд «${current.name}» видалено.`)
        brands.reload()
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
    <ListPage className="catalog-dictionary-page catalog-brands-page">
      <PageHeader
        title="Бренди"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
            Новий бренд
          </Button>
        }
      />

      <ScreenTabs
        label="Вибірка брендів"
        value={values.usage}
        onChange={(usage) => set({ usage })}
        tabs={USAGE_OPTIONS.map(({ value, label, icon }) => ({
          value,
          label: <MetricLabel icon={icon}>{label}</MetricLabel>,
          count: brands.data ? usageCounts[value] : null,
          footer: <MetricTrack value={usageCounts[value]} max={all.length} />,
        }))}
      />

      <FilterBar
        search={<ListSearch value={values.q} placeholder="Назва або адреса…" onChange={(q) => set({ q })} />}
        actions={
          <>
            {filtered ? (
              <Tooltip label="Скинути">
                <ActionIcon variant="default" aria-label="Скинути фільтри" onClick={reset}>
                  <IconFilterOff size={17} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {brands.data && filtered ? (
              <span className="app-filter-summary catalog-summary">
                Знайдено {countFormat.format(rows.length)} з {countFormat.format(all.length)}
              </span>
            ) : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={brands.isFetching} onClick={brands.reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      />

      <ListPageBody>
        <DictionaryLayout picked={Boolean(selectedId && picked.id === selectedId)} onBack={() => pick({ id: null })}>
          <div className="app-split-list">
            <DataTable
              ariaLabel="Довідник брендів"
              columns={columns}
              data={brands.status === 'error' || brands.status === 'forbidden' ? [] : rows}
              getRowId={getRowId}
              isLoading={brands.isLoading}
              isFetching={brands.isFetching}
              minWidth={compact ? 240 : 430}
              height="100%"
              onRowClick={selectBrand}
              rowClassName={rowClassName}
              emptyText={listEmptyText(brands, 'Не вдалося завантажити бренди.', filtered ? 'Нічого не знайдено.' : 'Брендів ще немає.')}
            />
          </div>
          <BrandDetailPane brand={selected} totalProducts={productCounts.data?.all ?? null} onEdit={open} onMerge={setMerging} />
        </DictionaryLayout>
      </ListPageBody>

      <CatalogEditorModal
        icon={IconCertificate}
        opened={drawer.opened}
        onClose={drawer.close}
        dirty={drawer.dirty}
        title={current ? `Бренд «${current.name}»` : 'Новий бренд'}
        size="standard"
        className="brand-editor-modal"
        closeOnEscape={!drawer.busy && !drawer.confirming && !merging}
        closeOnClickOutside={!drawer.busy && !drawer.confirming && !merging}
        footer={
          <EditorDrawerFooter
            formId={FORM_ID}
            busy={drawer.busy}
            onCancel={drawer.close}
            onDelete={current ? () => drawer.setConfirming(true) : undefined}
            extra={
              current ? (
                <Button variant="subtle" color="gray" leftSection={<IconArrowMerge size={16} stroke={1.7} />} disabled={drawer.busy || drawer.dirty} onClick={() => setMerging(current)}>
                  Об&apos;єднати з…
                </Button>
              ) : null
            }
          />
        }
      >
        {drawer.editing ? (
          <BrandForm key={drawer.editing.key} formId={FORM_ID} brand={drawer.editing.item} error={drawer.actionError} onBusy={drawer.setBusy} onSaved={saved} onDirty={drawer.setDirty} />
        ) : null}
      </CatalogEditorModal>

      <ConfirmDialog
        opened={drawer.confirming}
        title="Видалити бренд"
        message={current ? `Бренд «${current.name}» зникне з довідника. Скасувати видалення не можна.` : ''}
        confirmLabel="Видалити бренд"
        danger
        busy={drawer.busy}
        onConfirm={() => void remove()}
        onClose={() => drawer.setConfirming(false)}
      />

      <BrandMergeDialog source={merging} brands={all} onMerged={merged} onClose={() => setMerging(null)} />
    </ListPage>
  )
}
