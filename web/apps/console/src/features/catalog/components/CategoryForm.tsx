import { Alert, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Switch, TagsInput, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { getAttributeNames, saveCategory, type ConsoleCategory } from '../api/catalogApi'
import type { AttributeDefinition } from '../api/dictionariesApi'
import { descendantIds, orderCategories } from '../lib/categoryTree'
import { ImageUploadField } from './ImageUploadField'

type CategoryFormProps = {
  formId: string
  category: ConsoleCategory | null
  all: ConsoleCategory[]
  attributes: AttributeDefinition[] | null
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: () => void
}

type Fields = {
  parentId: string | null
  name: string
  slug: string
  navkoloRef: string
  filterAttributes: string[]
  sortOrder: number | string
  isVisible: boolean
  imageUrl: string | null
  description: string
  seoTitle: string
  seoDescription: string
}

const MAX_FILTERS = 10
const MAX_DESCRIPTION = 2000

const orNull = (value: string) => value.trim() || null

export function CategoryForm({ formId, category, all, attributes, error, onBusy, onSaved }: CategoryFormProps) {
  const { can } = usePermissions()
  const isTop = category !== null && !category.parentId
  const [fields, setFields] = useState<Fields>(() => ({
    parentId: category?.parentId ?? null,
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    navkoloRef: category?.navkoloRef ?? '',
    filterAttributes: category?.filterAttributes ?? [],
    sortOrder: category?.sortOrder ?? 0,
    isVisible: category?.isVisible ?? true,
    imageUrl: category?.imageUrl ?? null,
    description: category?.description ?? '',
    seoTitle: category?.seoTitle ?? '',
    seoDescription: category?.seoDescription ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const names = useApiQuery(`catalog-attribute-names:${category?.id ?? 'new'}`, () => getAttributeNames(category?.id))

  const parents = useMemo(() => {
    const excluded = category ? descendantIds(all, category.id) : new Set<string>()
    return orderCategories(all)
      .filter((c) => !excluded.has(c.id))
      .map((c) => ({ value: c.id, label: `${'— '.repeat(c.depth)}${c.name}` }))
  }, [all, category])

  const usage = useMemo(() => new Map((names.data ?? []).map((entry) => [entry.name.toLowerCase(), entry.productCount])), [names.data])
  const filterOptions = useMemo(() => {
    if (!attributes) return []
    const known = [...attributes]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'uk'))
      .map((attribute) => {
        const count = usage.get(attribute.name.toLowerCase())
        const unit = attribute.unit ? `, ${attribute.unit}` : ''
        return { value: attribute.name, label: count ? `${attribute.name}${unit} · у ${count} тов.` : `${attribute.name}${unit}` }
      })
    const missing = fields.filterAttributes.filter((name) => !attributes.some((attribute) => attribute.name === name))
    return [...known, ...missing.map((name) => ({ value: name, label: `${name} (немає в довіднику)` }))]
  }, [attributes, fields.filterAttributes, usage])
  const unknownFilters = attributes ? fields.filterAttributes.filter((name) => !attributes.some((attribute) => attribute.name === name)) : []

  const usedNames = (names.data ?? []).filter((entry) => entry.productCount > 0)
  const namesHelp =
    usedNames.length > 0
      ? `У товарах категорії: ${usedNames
          .slice(0, 12)
          .map((n) => `${n.name} (${n.productCount})`)
          .join(', ')}.`
      : 'Порожньо — фільтри батьківської категорії.'

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const result = await withCsrf((headers) =>
        saveCategory(headers, category ? category.id : null, {
          parentId: isTop ? null : fields.parentId || null,
          name: orNull(fields.name),
          slug: orNull(fields.slug),
          sortOrder: Number(fields.sortOrder) || 0,
          isVisible: fields.isVisible,
          navkoloRef: orNull(fields.navkoloRef),
          filterAttributes: fields.filterAttributes.map((s) => s.trim()).filter(Boolean),
          imageUrl: fields.imageUrl,
          description: orNull(fields.description),
          seoTitle: orNull(fields.seoTitle),
          seoDescription: orNull(fields.seoDescription),
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
    <form id={formId} noValidate onSubmit={submit} aria-label={category ? `Категорія «${category.name}»` : 'Нова підкатегорія'}>
      <Stack gap="sm">
        {isTop ? null : (
          <Select
            label="Батьківська категорія"
            placeholder="Оберіть"
            data={parents}
            value={fields.parentId}
            searchable
            nothingFoundMessage="Нічого не знайдено"
            error={errors.parentId || undefined}
            onChange={(value) => set('parentId', value)}
          />
        )}
        <TextInput
          label="Назва"
          required
          maxLength={200}
          value={fields.name}
          error={errors.name || undefined}
          onChange={(event) => set('name', event.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          label="Адреса (порожньо — з назви)"
          maxLength={200}
          spellCheck={false}
          autoComplete="off"
          value={fields.slug}
          error={errors.slug || undefined}
          onChange={(event) => set('slug', event.currentTarget.value)}
        />
        <TextInput
          label="Група Navkolo"
          description="Нові товари цієї групи під час імпорту потрапляють у цю категорію."
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          maxLength={100}
          value={fields.navkoloRef}
          error={errors.navkoloRef || undefined}
          onChange={(event) => set('navkoloRef', event.currentTarget.value)}
        />
        <ImageUploadField
          label="Фото плитки"
          value={fields.imageUrl}
          alt={fields.name}
          description="Показується на головній і в меню каталогу. JPEG, PNG або WebP."
          error={errors.imageUrl || undefined}
          onChange={(url) => set('imageUrl', url)}
        />
        <Textarea
          label="Опис категорії"
          description={`Текст під заголовком сторінки категорії, кожен абзац з нового рядка. ${fields.description.length} з ${MAX_DESCRIPTION}.`}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          autosize
          minRows={3}
          maxRows={10}
          maxLength={MAX_DESCRIPTION}
          value={fields.description}
          error={errors.description || undefined}
          onChange={(event) => set('description', event.currentTarget.value)}
        />
        {attributes ? (
          <MultiSelect
            label="Фільтри категорії"
            description={
              <>
                До {MAX_FILTERS} характеристик із довідника. {namesHelp}
                {can(PermissionKeys.Catalog.ManageAttributes) ? (
                  <>
                    {' '}
                    <Link to="/catalog/attributes" className="catalog-link">
                      Довідник характеристик
                    </Link>
                  </>
                ) : null}
              </>
            }
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            placeholder={fields.filterAttributes.length ? undefined : 'Як у батьківської категорії'}
            data={filterOptions}
            value={fields.filterAttributes}
            maxValues={MAX_FILTERS}
            searchable
            clearable
            hidePickedOptions
            nothingFoundMessage="Немає в довіднику характеристик"
            comboboxProps={{ withinPortal: true }}
            error={errors.filterAttributes || (unknownFilters.length ? `Немає в довіднику: ${unknownFilters.join(', ')}. Додайте їх у «Характеристики» або приберіть.` : undefined)}
            onChange={(value) => set('filterAttributes', value)}
          />
        ) : (
          <TagsInput
            label="Характеристики для фільтрів, через кому"
            description={namesHelp}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            data={(names.data ?? []).map((entry) => entry.name)}
            value={fields.filterAttributes}
            maxTags={MAX_FILTERS}
            splitChars={[',']}
            acceptValueOnBlur
            clearable
            error={errors.filterAttributes || undefined}
            onChange={(value) => set('filterAttributes', value)}
          />
        )}
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput label="Порядок показу" allowDecimal={false} value={fields.sortOrder} onChange={(value) => set('sortOrder', value)} />
          <Switch label="Показувати на сайті" mt={30} checked={fields.isVisible} onChange={(event) => set('isVisible', event.currentTarget.checked)} />
        </SimpleGrid>
        <TextInput label="SEO: заголовок" maxLength={200} value={fields.seoTitle} error={errors.seoTitle || undefined} onChange={(event) => set('seoTitle', event.currentTarget.value)} />
        <TextInput
          label="SEO: опис"
          maxLength={500}
          value={fields.seoDescription}
          error={errors.seoDescription || undefined}
          onChange={(event) => set('seoDescription', event.currentTarget.value)}
        />
        {shownError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {shownError}
          </Alert>
        ) : null}
      </Stack>
    </form>
  )
}
