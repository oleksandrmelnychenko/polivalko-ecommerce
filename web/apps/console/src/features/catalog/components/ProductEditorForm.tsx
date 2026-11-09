import { Alert, Button, Select, SimpleGrid, Switch, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { updateProduct, type Product, type UpdateProductRequest } from '../api/catalogApi'
import type { Brand, ProductLabel } from '../api/dictionariesApi'
import type { CategoryOption } from '../lib/categoryTree'
import { attributeRows, type AttributeRow } from '../lib/attributeRows'
import { ProductEditorAttributes } from './ProductEditorAttributes'
import { ProductEditorLabels } from './ProductEditorLabels'

type Fields = {
  displayName: string
  slug: string
  categoryId: string
  brand: string
  isVisible: boolean
  seoTitle: string
  seoDescription: string
}

type ProductEditorFormProps = {
  formId: string
  product: Product
  categories: CategoryOption[]
  brands: Brand[] | null
  labels: ProductLabel[] | null
  readOnly: boolean
  onBusy: (busy: boolean) => void
  onSaved: (product: Product) => void
}

function dictionaryBrand(brand: string | null, brands: Brand[] | null): string {
  const value = brand?.trim() ?? ''
  const match = value ? brands?.find((entry) => entry.name.toLowerCase() === value.toLowerCase()) : undefined
  return match?.name ?? value
}

function initialFields(product: Product, brands: Brand[] | null): Fields {
  return {
    displayName: product.displayName ?? '',
    slug: product.slug,
    categoryId: product.categoryId,
    brand: dictionaryBrand(product.brand, brands),
    isVisible: product.isVisible,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
  }
}

const orNull = (value: string) => value.trim() || null

function initialLabelIds(product: Product): string[] {
  return [...product.labelIds]
}

export function ProductEditorForm({ formId, product, categories, brands, labels, readOnly, onBusy, onSaved }: ProductEditorFormProps) {
  const { can } = usePermissions()
  const [fields, setFields] = useState<Fields>(() => initialFields(product, brands))
  const [description, setDescription] = useState(product.descriptionHtml ?? '')
  const [attributes, setAttributes] = useState<AttributeRow[]>(() => attributeRows(product.attributes))
  const [labelIds, setLabelIds] = useState<string[]>(() => initialLabelIds(product))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const categoryData = categories.some((option) => option.value === product.categoryId)
    ? categories
    : [{ value: product.categoryId, label: 'Поточна категорія' }, ...categories]
  const brandData = useMemo(() => {
    const names = [...(brands ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'uk')).map((brand) => ({ value: brand.name, label: brand.name }))
    const current = fields.brand.trim()
    return current && !names.some((option) => option.value === current) ? [{ value: current, label: `${current} (немає в довіднику)` }, ...names] : names
  }, [brands, fields.brand])

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (readOnly || busy) return
    const form = event.currentTarget
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const body: UpdateProductRequest = {
        displayName: orNull(fields.displayName),
        slug: orNull(fields.slug),
        categoryId: orNull(fields.categoryId),
        brand: orNull(fields.brand),
        descriptionHtml: orNull(description),
        isVisible: fields.isVisible,
        seoTitle: orNull(fields.seoTitle),
        seoDescription: orNull(fields.seoDescription),
        attributes: attributes.filter((a) => a.name.trim() || a.value.trim()).map(({ name, value }) => ({ name, value })),
        labelIds: labels === null ? undefined : labelIds,
      }
      const result = await withCsrf((headers) => updateProduct(headers, product.id, body))
      if (result.data) {
        setErrors({})
        notifySuccess('Товар збережено. Вітрина оновиться протягом хвилини.')
        setBusy(false)
        onBusy(false)
        onSaved(result.data)
        return
      }
      const message = problemMessage(result.error, 'Товар не збережено.')
      setErrors(fieldErrors(result.error))
      setFormError(message)
      notifyError(message)
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    } catch {
      setFormError(NETWORK_ERROR)
      notifyError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  return (
    <form id={formId} noValidate onSubmit={submit} aria-label="Поля сайту">
      <fieldset className="catalog-fieldset" disabled={readOnly}>
        {formError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {formError}
          </Alert>
        ) : null}

        <section className="catalog-card" aria-labelledby="main-title">
          <h2 id="main-title" className="app-section-title catalog-card-title">
            Вітрина
          </h2>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
            <TextInput
              label="Назва на вітрині"
              value={fields.displayName}
              placeholder={product.navkolo.name}
              maxLength={500}
              error={errors.displayName}
              onChange={(event) => set('displayName', event.currentTarget.value)}
            />
            <TextInput
              label="Адреса сторінки"
              description="Після зміни стара адреса перенаправлятиме на нову."
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              value={fields.slug}
              maxLength={300}
              spellCheck={false}
              autoComplete="off"
              error={errors.slug}
              onChange={(event) => set('slug', event.currentTarget.value)}
            />
            <Select
              label="Категорія на сайті"
              description="Приховані категорії позначено. Товар у такій категорії на сайті не видно."
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              data={categoryData}
              value={fields.categoryId}
              allowDeselect={false}
              searchable
              nothingFoundMessage="Нічого не знайдено"
              error={errors.categoryId}
              onChange={(value) => set('categoryId', value ?? product.categoryId)}
            />
            {brands === null ? (
              <TextInput label="Бренд" value={fields.brand} maxLength={200} error={errors.brand} onChange={(event) => set('brand', event.currentTarget.value)} />
            ) : (
              <Select
                label="Бренд"
                description={
                  <>
                    Зі списку брендів.{' '}
                    {can(PermissionKeys.Catalog.ManageBrands) ? (
                      <Link to="/catalog/brands" className="catalog-link">
                        Довідник брендів
                      </Link>
                    ) : null}
                  </>
                }
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                placeholder="Без бренду"
                data={brandData}
                value={fields.brand.trim() || null}
                searchable
                clearable
                nothingFoundMessage="Немає в довіднику брендів"
                error={errors.brand}
                onChange={(value) => set('brand', value ?? '')}
              />
            )}
          </SimpleGrid>
          <Switch
            mt="md"
            label="Показувати на сайті"
            checked={fields.isVisible}
            onChange={(event) => set('isVisible', event.currentTarget.checked)}
          />
        </section>

        <section className="catalog-card" aria-labelledby="description-title">
          <h2 id="description-title" className="app-section-title catalog-card-title">
            Опис
          </h2>
          <Textarea
            label="Опис (HTML: абзаци, списки, заголовки, таблиці, посилання)"
            description="Скрипти, стилі й вбудовані фото сервер прибирає під час збереження."
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            classNames={{ input: 'catalog-code-area' }}
            autosize
            minRows={8}
            maxRows={24}
            spellCheck={false}
            value={description}
            error={errors.descriptionHtml}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          {description.trim() ? (
            <details className="catalog-preview">
              <summary>Попередній перегляд</summary>
              <iframe title="Попередній перегляд опису" sandbox="" srcDoc={description} />
            </details>
          ) : null}
        </section>

        <ProductEditorLabels product={product} labels={labels} value={labelIds} onChange={setLabelIds} error={errors.labelIds} />

        <ProductEditorAttributes attributes={attributes} setAttributes={setAttributes} categoryId={fields.categoryId} readOnly={readOnly} error={errors.attributes} />

        <section className="catalog-card" aria-labelledby="seo-title">
          <h2 id="seo-title" className="app-section-title catalog-card-title">
            SEO
          </h2>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
            <TextInput
              label="SEO: заголовок"
              value={fields.seoTitle}
              maxLength={200}
              placeholder="Як назва на вітрині"
              error={errors.seoTitle}
              onChange={(event) => set('seoTitle', event.currentTarget.value)}
            />
            <TextInput
              label="SEO: опис"
              value={fields.seoDescription}
              maxLength={500}
              placeholder="Перші речення опису"
              error={errors.seoDescription}
              onChange={(event) => set('seoDescription', event.currentTarget.value)}
            />
          </SimpleGrid>
        </section>

        {readOnly ? null : (
          <div className="catalog-form-actions">
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} stroke={1.8} />} loading={busy}>
              Зберегти товар
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  )
}
