import { siteUrl } from '@/shared/lib/siteUrl'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { Alert, Button, Select, SimpleGrid, Switch, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle, IconBuildingStore, IconAlignLeft, IconSearch, IconBarcode, IconChartHistogram, IconExternalLink } from '@tabler/icons-react'
import { useMemo, useState, type ReactNode, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { LeaveGuard } from '@/shared/ui/LeaveGuard'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { updateProduct, type Product, type UpdateProductRequest } from '../api/catalogApi'
import type { Brand, ProductLabel } from '../api/dictionariesApi'
import type { CategoryOption } from '../lib/categoryTree'
import { attributeRows, type AttributeRow } from '../lib/attributeRows'
import { cleanProductName } from '@/shared/lib/cleanProductName'
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
  gallery: ReactNode
  formId: string
  product: Product
  categories: CategoryOption[]
  brands: Brand[] | null
  labels: ProductLabel[] | null
  disabled: boolean
  readOnly: boolean
  onBusy: (busy: boolean) => void
  onDirty: (dirty: boolean) => void
  onSaved: (product: Product) => void
}

function dictionaryBrand(brand: string | null, brands: Brand[] | null): string {
  const value = brand?.trim() ?? ''
  const match = value ? brands?.find((entry) => entry.name.toLowerCase() === value.toLowerCase()) : undefined
  return match?.name ?? value
}

type AccountingFields = NonNullable<UpdateProductRequest['accounting']>['value']
const accountingInputs = [
  ['sku', 'Артикул', 100], ['name', 'Назва в обліку', 500], ['groupRef', 'Група обліку', 100],
  ['variantGroup', 'Група варіантів', 100], ['variantLabel', 'Назва варіанта', 100],
] as const

function accountingFields(product: Product): AccountingFields {
  const { sku, name, groupRef, variantGroup, variantLabel } = product.navkolo
  return { sku, name, groupRef: groupRef ?? null, variantGroup: variantGroup ?? null, variantLabel: variantLabel ?? null }
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

function filledAttributes(attributes: AttributeRow[]) {
  return attributes.filter((a) => a.name.trim() || a.value.trim()).map(({ name, value }) => ({ name, value }))
}

function editorSnapshot(fields: Fields, description: string, attributes: AttributeRow[], labelIds: string[]): string {
  return JSON.stringify({ fields, description, attributes: filledAttributes(attributes), labelIds })
}

export function ProductEditorForm({ gallery, formId, product, categories, brands, labels, readOnly, disabled, onBusy, onDirty, onSaved }: ProductEditorFormProps) {
  const { can } = usePermissions()
  const [start] = useState(() => ({
    accounting: accountingFields(product),
    fields: initialFields(product, brands),
    description: product.descriptionHtml ?? '',
    attributes: attributeRows(product.attributes),
    labelIds: initialLabelIds(product),
  }))
  const [fields, setFields] = useState<Fields>(start.fields)
  const [account, setAccount] = useState(() => ({ ...start.accounting, name: cleanProductName(start.accounting.name) }))
  const accountChanged = accountingInputs.some(([key]) => account[key] !== (key === 'name' ? cleanProductName(start.accounting.name) : start.accounting[key]))
  const [description, setDescription] = useState(start.description)
  const [attributes, setAttributes] = useState<AttributeRow[]>(start.attributes)
  const [labelIds, setLabelIds] = useState<string[]>(start.labelIds)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pristine = useMemo(() => editorSnapshot(start.fields, start.description, start.attributes, start.labelIds), [start])
  const dirty = !readOnly && (accountChanged || editorSnapshot(fields, description, attributes, labelIds) !== pristine)
  useReportDirty(dirty, onDirty)

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
    if (readOnly || busy || disabled) return
    const form = event.currentTarget
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const body: UpdateProductRequest = {
        accounting: accountChanged ? { expected: start.accounting, value: account } : undefined,
        displayName: orNull(fields.displayName),
        slug: orNull(fields.slug),
        categoryId: orNull(fields.categoryId),
        brand: orNull(fields.brand),
        descriptionHtml: orNull(description),
        isVisible: fields.isVisible,
        seoTitle: orNull(fields.seoTitle),
        seoDescription: orNull(fields.seoDescription),
        attributes: filledAttributes(attributes),
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
      requestAnimationFrame(() => {
        const invalid = Array.from(form.elements).find(element => element.matches('[aria-invalid="true"]'))
        const target = invalid ?? form.querySelector('[role="alert"]')
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    } catch {
      setFormError(NETWORK_ERROR)
      notifyError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  return (
    <div className="product-editor-columns">
      <form id={formId} noValidate onSubmit={submit} aria-label="Редагування товару">
        <fieldset className="catalog-fieldset" disabled={readOnly || disabled || busy}>
          {formError ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {formError}
            </Alert>
          ) : null}

          <section className="catalog-card" aria-labelledby="main-title">
            <CatalogSectionTitle id="main-title" icon={IconBuildingStore}>Вітрина</CatalogSectionTitle>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="xs">
              <TextInput
                label="Назва на вітрині"
                value={fields.displayName}
                placeholder={cleanProductName(product.navkolo.name)}
                maxLength={500}
                error={errors.displayName}
                onChange={(event) => set('displayName', event.currentTarget.value)}
              />
              <TextInput
                label="Адреса сторінки"
                value={fields.slug}
                maxLength={300}
                spellCheck={false}
                autoComplete="off"
                error={errors.slug}
                onChange={(event) => set('slug', event.currentTarget.value)}
              />
              <Select
                label="Категорія на сайті"
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
              mt="xs"
              label="Показувати на сайті"
              checked={fields.isVisible}
              onChange={(event) => set('isVisible', event.currentTarget.checked)}
            />
          </section>

          <section className="catalog-card" aria-labelledby="description-title">
            <CatalogSectionTitle id="description-title" icon={IconAlignLeft}>Опис</CatalogSectionTitle>
            <Textarea
              aria-label="Опис товару"
              classNames={{ input: 'catalog-code-area' }}
              autosize
              minRows={3}
              maxRows={9}
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

          <ProductEditorAttributes attributes={attributes} setAttributes={setAttributes} categoryId={fields.categoryId} readOnly={readOnly} error={errors.attributes} />

          <section className="catalog-card" aria-labelledby="seo-title">
            <CatalogSectionTitle id="seo-title" icon={IconSearch}>SEO</CatalogSectionTitle>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="xs">
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

        </fieldset>
        <LeaveGuard when={dirty} message="Зміни в товарі не збережено. Піти зі сторінки без збереження?" />
      </form>
      <aside className="product-editor-side">
        {gallery}
        <fieldset className="catalog-fieldset" disabled={readOnly || disabled || busy}>
          <section className="catalog-card" aria-labelledby="accounting-title">
            <CatalogSectionTitle id="accounting-title" icon={IconBarcode}>Облікові дані</CatalogSectionTitle>
            <div className="product-account-fields">
              {accountingInputs.map(([key, label, limit]) => (
                <TextInput key={key} form={formId} label={label} maxLength={limit} value={account[key] ?? ''}
                  className={key === 'sku' ? 'product-sku' : undefined}
                  error={errors[key]} onChange={event => {
                    const value = event.currentTarget.value
                    setAccount(current => ({ ...current, [key]: key === 'sku' || key === 'name' ? value : value || null }))
                  }} />
              ))}
            </div>
          </section>
          <ProductEditorLabels product={product} labels={labels} value={labelIds} onChange={setLabelIds} error={errors.labelIds} />
        </fieldset>
        <div className="product-related-links">
          {can(PermissionKeys.Analytics.ViewProducts) && (
            <Button component={Link} to={'/sales/product-analytics?source=dntrade&product=' + product.id}
              variant="default" radius="xl" size="xs" leftSection={<IconChartHistogram size={15} />}>
              Аналітика товару
            </Button>
          )}
          <Button component="a" href={siteUrl('/product/' + product.slug)} target="_blank" rel="noopener"
            variant="default" radius="xl" size="xs" leftSection={<IconExternalLink size={15} />}>
            Відкрити на сайті
          </Button>
        </div>
      </aside>
    </div>
  )
}
