import { ActionIcon, Button, SegmentedControl, Skeleton, Tooltip } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconDatabase, IconRefresh, IconSearch, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { kyivDay, shiftDay } from '@/shared/lib/kyivTime'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getProductAnalytics, type AnalyticsSource, type ProductAnalytics } from '../api/productAnalyticsApi'
import { AnalyticsInventory } from '../components/AnalyticsInventory'
import { AnalyticsProducts } from '../components/AnalyticsProducts'
import { AnalyticsReport } from '../components/AnalyticsReport'
import { dateLabel, dateRange, formatAmount } from '../lib/format'
import './product-analytics.css'

const TITLE = 'Аналітика товарів'
const MIN_END = '2000-01-01'
const CATALOG_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
const PERIODS = [30, 90, 180, 365] as const
const PERIOD_OPTIONS = PERIODS.map((days) => String(days))

export function ProductAnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const { can } = usePermissions()
  const legacyCatalogLink = !params.has('source') && CATALOG_ID.test(params.get('product') ?? '')
  const source: AnalyticsSource = params.get('source') === 'web' || legacyCatalogLink ? 'web' : 'dntrade'
  const days = PERIODS.find((period) => String(period) === params.get('days')) ?? 90
  const product = params.get('product')?.trim() || undefined
  const search = params.get('search')?.trim().slice(0, 120) ?? ''
  const [searchDraft, setSearchDraft] = useState(() => ({ search, text: search }))
  const displayedSearch = searchDraft.search === search ? searchDraft.text : search
  if (searchDraft.search !== search) setSearchDraft({ search, text: search })
  const rawEnd = params.get('end') ?? ''
  const yesterday = shiftDay(kyivDay(new Date()), -1)
  const parsedEnd = new Date(rawEnd)
  const end = rawEnd >= MIN_END && rawEnd <= yesterday && Number.isFinite(parsedEnd.getTime()) && parsedEnd.toISOString().slice(0, 10) === rawEnd ? rawEnd : undefined
  const rawPage = Number(params.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1_000_000) : 1
  const scope = JSON.stringify([source, days, end, product])
  const query = useApiQuery(JSON.stringify([scope, search, page]), async () => {
    const result = await getProductAnalytics({ source, days, end, product, search: search || undefined, page })
    return { ...result, data: result.data ? { scope, report: result.data } : undefined }
  }, { keepPrevious: true })
  const report = query.data?.scope === scope ? query.data.report : undefined
  const inventory = report && !report.selectedProduct ? <AnalyticsInventory inventory={report.inventory} /> : null
  const showProducts = Boolean(report && (report.trend.length || report.products.total || search))

  function update(patch: Record<string, string | undefined>, replace = true) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    }, { replace })
  }

  function selectProduct(key: string) {
    update({ product: key, source }, false)
    const heading = document.getElementById('product-analytics-heading')
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView({ block: 'start' })
  }

  function goToProducts() {
    const products = document.getElementById('analytics-products')
    products?.scrollIntoView({ block: 'start' })
    products?.querySelector('input')?.focus({ preventScroll: true })
  }

  return (
    <>
      <PageHeader title={TITLE} actions={
        <div className="pa-heading-actions">
          {showProducts && <Button variant="default" radius="xl" disabled={query.status !== 'ready'} leftSection={<IconSearch size={16} stroke={1.8} />} onClick={goToProducts}>
            Знайти товар
          </Button>}
          <Tooltip label="Оновити звіт">
            <ActionIcon size={36} radius="xl" variant="default" aria-label="Оновити звіт" loading={query.isFetching} onClick={query.reload}>
              <IconRefresh size={17} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
        </div>
      } />
      <div className="pa-page pa-product-workspace">
        <header className="pa-header" id="product-analytics-heading" tabIndex={-1} aria-label="Фільтри звіту">
          <div className="pa-filters">
            <div className="pa-source-field">
              <span className="mantine-InputWrapper-label" id="pa-source-label">Джерело продажів</span>
              <SegmentedControl
                aria-labelledby="pa-source-label"
                value={source}
                data={[{ value: 'dntrade', label: 'DNTrade' }, { value: 'web', label: 'Інтернет-магазин' }]}
                onChange={(value) => update({ source: value, product: product && CATALOG_ID.test(product) ? product : undefined, page: undefined }, false)}
              />
            </div>
            <div className="pa-source-field">
              <span className="mantine-InputWrapper-label" id="pa-period-label">Період у днях</span>
              <SegmentedControl
                aria-labelledby="pa-period-label"
                className="pa-period-options"
                value={String(days)}
                data={PERIOD_OPTIONS}
                onChange={(value) => update({ days: value, page: undefined })}
              />
            </div>
            <DatePickerInput
              label="Останній день періоду"
              value={end ?? report?.to ?? yesterday}
              minDate={MIN_END}
              maxDate={yesterday}
              valueFormat="DD.MM.YYYY"
              clearable={Boolean(end)}
              clearButtonProps={{ 'aria-label': 'Відкрити останній доступний період' }}
              onChange={(value) => update({ end: value ?? undefined, page: undefined })}
            />
            {product ? (
              <Button variant="light" color="gray" rightSection={<IconX size={16} stroke={1.8} />} onClick={() => update({ product: undefined }, false)}>
                Усі товари
              </Button>
            ) : null}
          </div>
        </header>

        {query.status === 'error' || query.status === 'forbidden' ? (
          <PageState kind={query.status} description={problemMessage(query.problem, 'Не вдалося завантажити товарну аналітику.')} onRetry={query.status === 'error' ? query.reload : undefined} />
        ) : report ? (
          <div className="pa-report" aria-busy={query.isFetching || undefined}>
            <Coverage report={report} onSetEnd={(date) => update({ end: date, page: undefined })}
              onShowArchive={() => update({ source: 'dntrade', product: product && CATALOG_ID.test(product) ? product : undefined, page: undefined, search: undefined }, false)} />
            {product && !report.selectedProduct ? <p className="pa-coverage" role="status">Товар за цим посиланням відсутній у вибраному джерелі. Показано загальний звіт.</p> : null}
            <AnalyticsReport report={report} canOpenProduct={can(PermissionKeys.Catalog.ViewProducts)} onSelectProduct={selectProduct} />
            {showProducts && <AnalyticsProducts
              products={report.products}
              search={search}
              draft={displayedSearch}
              productKey={report.selectedProduct?.productKey}
              returnsAvailable={report.coverage.returnsAvailable}
              isFetching={query.isFetching}
              onDraftChange={(text) => setSearchDraft({ search, text })}
              onSearch={(value) => update({ search: value, page: undefined })}
              onPageChange={(value) => update({ page: value === 1 ? undefined : String(value) })}
              onSelect={selectProduct}
            />}
            {inventory && <details className="pa-methods"><summary>Поточні залишки інтернет-магазину</summary>{inventory}</details>}
            {report.trend.length > 0 && <details className="pa-methods">
              <summary>Як розраховані показники</summary>
              <p>Дати згруповано за київським часом. Зміни порівнюються з попереднім періодом такої самої тривалості.</p>
              {source === 'dntrade' ? <p>Межі архіву визначаються за датами імпортованих документів. Якщо імпорт частковий, показники відображають лише завантажені операції.</p> : null}
              <p>Чиста виручка враховує доступні товарні повернення. ABC-клас показує внесок SKU у виручку вибраного джерела за період.</p>
              <p>Залишок береться з каталогу сайту після резервів. Дні запасу розраховуються для інтернет-магазину за актуальний період, коли відомий темп продажів.</p>
            </details>}
          </div>
        ) : query.isFetching ? <Loading /> : (
          <PageState kind="error" description="Сервіс не повернув товарний звіт за вибраний період." onRetry={query.reload} />
        )}
      </div>
    </>
  )
}

function Coverage({ report, onSetEnd, onShowArchive }: { report: ProductAnalytics; onSetEnd: (date: string) => void; onShowArchive: () => void }) {
  const { firstSourceDay, lastSourceDay, ignoredDocuments, unmatchedLines, returnsAvailable } = report.coverage
  const archive = report.source === 'dntrade'
  const lastBeforePeriodEnd = Boolean(archive && lastSourceDay && lastSourceDay < report.to)
  const noOverlap = Boolean(firstSourceDay && (firstSourceDay > report.to || (archive && lastSourceDay && lastSourceDay < report.from)))
  const partial = Boolean(firstSourceDay && lastSourceDay && !noOverlap && (firstSourceDay > report.from || lastBeforePeriodEnd))

  return (
    <div className="pa-coverage" data-attention={partial || noOverlap || undefined}>
      <IconDatabase size={20} stroke={1.7} aria-hidden="true" />
      <div>
        <strong>{dateRange(report.from, report.to)}</strong>
        <p>{firstSourceDay && lastSourceDay ? `${archive ? 'Дані джерела' : 'Зафіксовані операції'}: ${dateRange(firstSourceDay, lastSourceDay)}` : 'У джерелі ще немає підтверджених даних про продажі.'}</p>
        {noOverlap ? <p>Історія цього джерела не охоплює вибрані дати.</p> : null}
        {partial ? <p>Історія цього джерела покриває лише частину вибраного періоду.</p> : null}
        {!returnsAvailable && report.trend.length > 0 ? <p>Повернення недоступні або неповні. Виручка показана за продажами.</p> : null}
        {ignoredDocuments > 0 ? <p>Пропущено документів: {formatAmount(ignoredDocuments)}.</p> : null}
        {unmatchedLines > 0 ? <p>Позицій без відповідника в каталозі: {formatAmount(unmatchedLines)}.</p> : null}
      </div>
      {archive && lastSourceDay && lastBeforePeriodEnd ? (
        <Button variant="default" size="xs" onClick={() => onSetEnd(lastSourceDay)}>Завершити період {dateLabel(lastSourceDay)}</Button>
      ) : null}
      {!archive && !firstSourceDay && <Button variant="default" size="xs" onClick={onShowArchive}>Переглянути продажі DNTrade</Button>}
    </div>
  )
}

function Loading() {
  return (
    <div className="pa-report" role="status" aria-busy="true" aria-label="Завантаження товарної аналітики">
      <Skeleton height={62} radius={12} />
      <div className="pa-metrics">{[0, 1, 2, 3].map((key) => <Skeleton key={key} height={114} radius={12} />)}</div>
      <Skeleton height={320} radius={12} />
    </div>
  )
}
