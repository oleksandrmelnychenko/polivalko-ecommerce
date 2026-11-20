import { ActionIcon, Alert, Button, Group, NumberInput, SimpleGrid, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAdjustmentsHorizontal, IconAlertCircle, IconArrowDown, IconArrowUp, IconPackages, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { formatMoney } from '@polivalko/shared/lib/format'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { getProducts, saveCollection, type ConsoleCollection, type ProductRow } from '../api/catalogApi'
import { productName } from '../lib/productFilters'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { ProductThumb } from './ProductThumb'

const MAX_ITEMS = 24
const SEARCH_FORBIDDEN = 'Щоб додавати товари в добірку, потрібне право перегляду товарів.'

type CollectionFormProps = {
  formId: string
  collection: ConsoleCollection | null
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: (collection: ConsoleCollection) => void
  onDirty?: (dirty: boolean) => void
}

type Fields = { title: string; code: string; sortOrder: number | string; isVisible: boolean }

export function CollectionForm({ formId, collection, error, onBusy, onSaved, onDirty }: CollectionFormProps) {
  const { can } = usePermissions()
  const [fields, setFields] = useState<Fields>(() => ({
    title: collection?.title ?? 'Рекомендовані товари',
    code: collection?.code ?? 'recommended',
    sortOrder: collection?.sortOrder ?? 1,
    isVisible: collection?.isVisible ?? true,
  }))
  const [items, setItems] = useState<ProductRow[]>(collection?.products ?? [])
  const snapshot = JSON.stringify({ fields, items: items.map((item) => item.id) })
  const [pristine] = useState(snapshot)
  useReportDirty(snapshot !== pristine, onDirty)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<ProductRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const canSearch = can(PermissionKeys.Catalog.ViewProducts)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function move(index: number, delta: number) {
    setItems((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
  }

  async function search(event: FormEvent) {
    event.preventDefault()
    if (!canSearch || searching) return
    setSearching(true)
    setSearchError(null)
    try {
      const { data, error, response } = await getProducts({ q: query.trim() || undefined, visible: true, pageSize: 20 })
      if (data) {
        setFound(data.items)
      } else {
        setFound(null)
        setSearchError(response.status === 403 ? SEARCH_FORBIDDEN : problemMessage(error, 'Не вдалося знайти товари. Спробуйте ще раз.'))
      }
    } catch {
      setFound(null)
      setSearchError(NETWORK_ERROR)
    }
    setSearching(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const result = await withCsrf((headers) =>
        saveCollection(headers, collection ? collection.id : null, {
          code: fields.code.trim(),
          title: fields.title.trim(),
          sortOrder: Number(fields.sortOrder) || 0,
          isVisible: fields.isVisible,
          productIds: items.map((item) => item.id),
        }),
      )
      if (result.data) {
        setBusy(false)
        onBusy(false)
        onSaved(result.data)
        return
      }
      setErrors(fieldErrors(result.error))
      setFormError(problemMessage(result.error, 'Добірку не збережено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  const shownError = formError ?? error

  return (
    <fieldset className="collection-editor" disabled={busy}>
      <form className="catalog-card collection-setup" id={formId} noValidate onSubmit={submit} aria-label={collection ? `Добірка «${collection.title}»` : 'Нова добірка'}>
        <CatalogSectionTitle id="collection-settings" icon={IconAdjustmentsHorizontal}>Налаштування добірки</CatalogSectionTitle>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput
            label="Назва добірки"
            required
            maxLength={200}
            value={fields.title}
            error={errors.title || undefined}
            onChange={(event) => set('title', event.currentTarget.value)}
            data-autofocus
          />
          <TextInput
            label="Код (латиницею)"
            required
            maxLength={50}
            spellCheck={false}
            autoComplete="off"
            value={fields.code}
            error={errors.code || undefined}
            onChange={(event) => set('code', event.currentTarget.value)}
          />
          <NumberInput label="Порядок на головній" allowDecimal={false} value={fields.sortOrder} onChange={(value) => set('sortOrder', value)} />
          <Switch label="Показувати на головній" className="collection-visible" checked={fields.isVisible} onChange={(event) => set('isVisible', event.currentTarget.checked)} />
        </SimpleGrid>
      </form>

      <section className="catalog-card collection-items" aria-labelledby="collection-items-title">
        <CatalogSectionTitle id="collection-items-title" icon={IconPackages} count={`${items.length} / ${MAX_ITEMS}`}>Товари в добірці</CatalogSectionTitle>
        {items.length > 0 ? (
          <ol className="catalog-pick-list">
            {items.map((item, index) => (
              <li key={item.id} className="catalog-pick-item">
                <span className="catalog-pick-index">{index + 1}</span>
                <ProductThumb url={item.imageUrl} size={32} />
                <span className="app-cell-stack catalog-pick-main">
                  <span className="app-cell-title">{productName(item)}</span>
                  <span className="app-cell-sub">
                    <span className="money">{formatMoney(item.price)}</span>
                    {item.isVisible ? null : " · прихований, на головній не з'явиться"}
                  </span>
                </span>
                <span className="catalog-pick-actions">
                  <Tooltip label="Вище">
                    <ActionIcon variant="subtle" color="gray" disabled={index === 0} aria-label={`Вище: ${item.name}`} onClick={() => move(index, -1)}>
                      <IconArrowUp size={16} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Нижче">
                    <ActionIcon variant="subtle" color="gray" disabled={index === items.length - 1} aria-label={`Нижче: ${item.name}`} onClick={() => move(index, 1)}>
                      <IconArrowDown size={16} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Прибрати">
                    <ActionIcon variant="subtle" color="red" aria-label={`Прибрати: ${item.name}`} onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))}>
                      <IconX size={16} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Text size="sm" c="dimmed">
            Товарів ще немає.
          </Text>
        )}
        {errors.productIds ? (
          <Text size="xs" c="red" mt={6} role="alert">
            {errors.productIds}
          </Text>
        ) : null}
      </section>

      <section aria-labelledby="collection-search-title" className="catalog-card collection-search">
        <CatalogSectionTitle id="collection-search-title" icon={IconSearch}>Додати товари</CatalogSectionTitle>
        <form role="search" onSubmit={search}>
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              aria-label="Знайти товар"
              placeholder="Назва або артикул"
              leftSection={<IconSearch size={16} stroke={1.7} />}
              value={query}
              autoComplete="off"
              disabled={!canSearch}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <Button type="submit" variant="default" loading={searching} disabled={!canSearch}>
              Знайти
            </Button>
          </Group>
        </form>
        {!canSearch || searchError ? (
          <Text size="sm" c={canSearch ? 'red' : 'dimmed'} mt="xs" role={canSearch ? 'alert' : undefined}>
            {canSearch ? searchError : SEARCH_FORBIDDEN}
          </Text>
        ) : null}
        {found && found.length === 0 ? (
          <Text size="sm" c="dimmed" mt="xs">
            Товарів за цими умовами немає.
          </Text>
        ) : null}
        {found && found.length > 0 ? (
          <ul className="catalog-pick-list catalog-pick-found">
            {found.map((item) => {
              const added = items.some((x) => x.id === item.id)
              return (
                <li key={item.id} className="catalog-pick-item">
                  <ProductThumb url={item.imageUrl} size={32} />
                  <span className="app-cell-stack catalog-pick-main">
                    <span className="app-cell-title">{productName(item)}</span>
                    <span className="app-cell-sub catalog-code">{item.sku}</span>
                  </span>
                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<IconPlus size={14} stroke={1.8} />}
                    disabled={added || items.length >= MAX_ITEMS}
                    onClick={() => setItems((list) => [...list, item])}
                  >
                    Додати
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      {shownError ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {shownError}
        </Alert>
      ) : null}
    </fieldset>
  )
}
