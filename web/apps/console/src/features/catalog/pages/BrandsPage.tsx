import { ActionIcon, Button, Select, Tooltip } from '@mantine/core'
import { IconArrowMerge, IconFilterOff, IconPencil, IconPhoto, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { deleteBrand, getBrands, type Brand } from '../api/dictionariesApi'
import { BrandForm } from '../components/BrandForm'
import { BrandMergeDialog } from '../components/BrandMergeDialog'
import { EditorDrawerFooter } from '../components/EditorDrawerFooter'
import { listEmptyText } from '../components/ListEmpty'
import { ListSearch } from '../components/ListSearch'
import { useEditorDrawer } from '../lib/useEditorDrawer'
import { useListParams } from '../lib/useListParams'
import '../components/catalog.css'
import '../components/catalog-dictionaries.css'

const FORM_ID = 'catalog-brand-form'
const PARAM_KEYS = ['q', 'usage'] as const
const USAGE_OPTIONS = [
  { value: 'used', label: 'З товарами' },
  { value: 'unused', label: 'Без товарів' },
  { value: 'no-logo', label: 'Без логотипа' },
]
const getRowId = (row: Brand) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

function BrandLogo({ url }: { url: string | null }) {
  return <span className="catalog-logo">{url ? <img src={url} alt="" loading="lazy" /> : <IconPhoto size={16} stroke={1.5} aria-hidden="true" />}</span>
}

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
  const brands = useApiQuery('catalog-brands', () => getBrands())
  const { values, set, reset } = useListParams(PARAM_KEYS)
  const drawer = useEditorDrawer<Brand>()
  const { open, current } = drawer
  const [merging, setMerging] = useState<Brand | null>(null)

  const all = useMemo(() => [...(brands.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'uk')), [brands.data])
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

  const columns = useMemo<DataTableColumn<Brand>[]>(
    () => [
      {
        id: 'name',
        header: 'Бренд',
        width: 280,
        minWidth: 220,
        accessor: (row) => row.name,
        cell: (row) => (
          <span className="catalog-product-cell">
            <BrandLogo url={row.logoUrl} />
            <CellStack title={row.name} sub={<span className="catalog-code">{row.slug}</span>} />
          </span>
        ),
      },
      {
        id: 'description',
        header: 'Опис',
        width: 320,
        fill: true,
        cell: (row) =>
          row.description ? (
            <span className="catalog-ellipsis" title={row.description}>
              {row.description}
            </span>
          ) : (
            <span className="catalog-muted">немає</span>
          ),
      },
      {
        id: 'products',
        header: 'Товарів',
        width: 110,
        align: 'right',
        numeric: true,
        sortDescFirst: true,
        accessor: (row) => row.productCount,
        cell: (row) =>
          row.productCount ? (
            <Link className="catalog-link" to={`/catalog/products?brand=${encodeURIComponent(row.name)}`}>
              {countFormat.format(row.productCount)}
            </Link>
          ) : (
            <NumberValue value={0} />
          ),
      },
      {
        id: 'actions',
        header: <span className="visually-hidden">Дії</span>,
        width: 92,
        align: 'center',
        cell: (row) => (
          <span className="catalog-row-actions">
            <Tooltip label="Об'єднати з…">
              <ActionIcon variant="subtle" color="gray" aria-label={`Об'єднати «${row.name}» з іншим брендом`} onClick={() => setMerging(row)}>
                <IconArrowMerge size={16} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Змінити">
              <ActionIcon variant="subtle" color="gray" aria-label={`Змінити «${row.name}»`} onClick={() => open(row)}>
                <IconPencil size={16} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </span>
        ),
      },
    ],
    [open],
  )

  function saved(next: Brand | undefined) {
    drawer.setOpened(false)
    notifySuccess(next && current && next.name !== current.name && current.productCount > 0 ? `Бренд перейменовано на «${next.name}», товарів: ${current.productCount}.` : 'Бренд збережено.')
    brands.reload()
  }

  function merged(source: Brand, target: Brand) {
    setMerging(null)
    drawer.setOpened(false)
    notifySuccess(`«${source.name}» об'єднано з «${target.name}».`)
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
    <ListPage>
      <PageHeader
        title="Бренди"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => open(null)}>
            Новий бренд
          </Button>
        }
      />

      <FilterBar
        activeCount={values.usage ? 1 : 0}
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
            {brands.data ? (
              <span className="app-filter-summary catalog-summary">
                {filtered ? `Знайдено: ${countFormat.format(rows.length)} з ${countFormat.format(all.length)}` : `Брендів: ${countFormat.format(all.length)}`}
              </span>
            ) : null}
            <Tooltip label="Оновити">
              <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={brands.isFetching} onClick={brands.reload}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      >
        <Select label="Показати" placeholder="Усі бренди" data={USAGE_OPTIONS} value={values.usage || null} clearable onChange={(usage) => set({ usage })} />
      </FilterBar>

      <ListPageBody>
        <DataTable
          ariaLabel="Довідник брендів"
          columns={columns}
          data={brands.status === 'error' || brands.status === 'forbidden' ? [] : rows}
          getRowId={getRowId}
          isLoading={brands.isLoading}
          isFetching={brands.isFetching}
          minWidth={860}
          height="100%"
          onRowClick={open}
          emptyText={listEmptyText(brands, 'Не вдалося завантажити бренди.', filtered ? 'Нічого не знайдено.' : 'Брендів ще немає.')}
        />
      </ListPageBody>

      <AppDrawer
        opened={drawer.opened}
        onClose={drawer.close}
        title={current ? `Бренд «${current.name}»` : 'Новий бренд'}
        size="compact"
        closeOnEscape={!drawer.busy}
        footer={
          <EditorDrawerFooter
            formId={FORM_ID}
            busy={drawer.busy}
            onCancel={drawer.close}
            onDelete={current ? () => drawer.setConfirming(true) : undefined}
            extra={
              current ? (
                <Button variant="subtle" color="gray" leftSection={<IconArrowMerge size={16} stroke={1.7} />} disabled={drawer.busy} onClick={() => setMerging(current)}>
                  Об&apos;єднати з…
                </Button>
              ) : null
            }
          />
        }
      >
        {drawer.editing ? (
          <BrandForm key={drawer.editing.key} formId={FORM_ID} brand={drawer.editing.item} error={drawer.actionError} onBusy={drawer.setBusy} onSaved={saved} />
        ) : null}
      </AppDrawer>

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
