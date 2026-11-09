import { ActionIcon, Alert, Button, Group, NumberInput, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconArrowDown, IconArrowUp, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { formatMoney } from '@polivalko/shared/lib/format'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { getProducts, saveCollection, type ConsoleCollection, type ProductRow } from '../api/catalogApi'
import { productName } from '../lib/productFilters'
import { ProductThumb } from './ProductThumb'

const MAX_ITEMS = 24

type CollectionFormProps = {
  formId: string
  collection: ConsoleCollection | null
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: () => void
}

type Fields = { title: string; code: string; sortOrder: number | string; isVisible: boolean }

export function CollectionForm({ formId, collection, error, onBusy, onSaved }: CollectionFormProps) {
  const [fields, setFields] = useState<Fields>(() => ({
    title: collection?.title ?? 'Рекомендовані товари',
    code: collection?.code ?? 'recommended',
    sortOrder: collection?.sortOrder ?? 1,
    isVisible: collection?.isVisible ?? true,
  }))
  const [items, setItems] = useState<ProductRow[]>(collection?.products ?? [])
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<ProductRow[] | null>(null)
  const [searching, setSearching] = useState(false)
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
    setSearching(true)
    try {
      const { data } = await getProducts({ q: query.trim() || undefined, visible: true, pageSize: 20 })
      setFound(data?.items ?? [])
    } catch {
      setFound([])
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
        onSaved()
        return
      }
      setErrors(fieldErrors(result.error))
      setFormError(problemMessage(result.error, 'Не збережено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  const shownError = formError ?? error

  return (
    <Stack gap="md">
      <form id={formId} noValidate onSubmit={submit} aria-label={collection ? `Добірка «${collection.title}»` : 'Нова добірка'}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <TextInput
              label="Заголовок на головній"
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
            <Switch label="Показувати на головній" mt={{ base: 0, xs: 30 }} checked={fields.isVisible} onChange={(event) => set('isVisible', event.currentTarget.checked)} />
          </SimpleGrid>
        </Stack>
      </form>

      <section aria-labelledby="collection-items-title">
        <h3 id="collection-items-title" className="app-section-title catalog-card-title">
          Товари ({items.length} з {MAX_ITEMS})
        </h3>
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
            Додайте товари пошуком нижче.
          </Text>
        )}
        {errors.productIds ? (
          <Text size="xs" c="red" mt={6} role="alert">
            {errors.productIds}
          </Text>
        ) : null}
      </section>

      <section aria-label="Знайти товар" className="catalog-pick-search">
        <form role="search" onSubmit={search}>
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label="Знайти товар"
              placeholder="Назва або артикул"
              leftSection={<IconSearch size={16} stroke={1.7} />}
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <Button type="submit" variant="default" loading={searching}>
              Знайти
            </Button>
          </Group>
        </form>
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
    </Stack>
  )
}
