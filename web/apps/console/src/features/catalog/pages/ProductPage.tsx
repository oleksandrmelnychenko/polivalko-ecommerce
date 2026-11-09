import { Alert, Button } from '@mantine/core'
import { IconDeviceFloppy, IconExternalLink, IconLock } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Can, usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { siteUrl } from '@/shared/lib/siteUrl'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getCategories, getProduct, type Product } from '../api/catalogApi'
import { getBrands, getLabels } from '../api/dictionariesApi'
import { ProductEditorForm } from '../components/ProductEditorForm'
import { ProductEditorImages } from '../components/ProductEditorImages'
import { ProductEditorNavkolo } from '../components/ProductEditorNavkolo'
import { consoleCategoryOptions } from '../lib/categoryTree'
import { withUniqueImages } from '../lib/productImages'
import '../components/catalog.css'

const FORM_ID = 'catalog-product-form'

export function ProductPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { can } = usePermissions()
  const product = useApiQuery(`catalog-product:${id}`, () => getProduct(id))
  const categoriesQuery = useApiQuery('catalog-categories', () => getCategories())
  const brandsQuery = useApiQuery('catalog-brands', () => getBrands())
  const labelsQuery = useApiQuery('catalog-labels', () => getLabels())
  const categories = useMemo(() => consoleCategoryOptions(categoriesQuery.data ?? []), [categoriesQuery.data])
  const brands = brandsQuery.status === 'ready' ? (brandsQuery.data ?? null) : null
  const labels = labelsQuery.status === 'ready' ? (labelsQuery.data ?? null) : null
  const dictionariesSettled = brandsQuery.status !== 'loading' && labelsQuery.status !== 'loading' && categoriesQuery.status !== 'loading'
  const [formKey, setFormKey] = useState('')
  const [saving, setSaving] = useState(false)
  const readOnly = !can(PermissionKeys.Catalog.EditProducts)

  const data = useMemo(() => (product.data?.id === id ? withUniqueImages(product.data) : undefined), [id, product.data])
  const name = data ? (data.displayName ?? data.navkolo.name) : 'Товар'

  function saved(next: Product) {
    product.setData(next)
    setFormKey(next.updatedAt)
  }

  return (
    <>
      <PageHeader
        title={name}
        heading={
          <span className="catalog-crumbs">
            <Link to="/catalog/products">Товари</Link>
            <span aria-hidden="true">/</span>
            <span className="catalog-crumbs-current">{name}</span>
          </span>
        }
        actions={
          data ? (
            <>
              <Button
                component="a"
                href={siteUrl(`/product/${data.slug}`)}
                target="_blank"
                rel="noopener"
                variant="default"
                leftSection={<IconExternalLink size={16} stroke={1.8} />}
              >
                Відкрити на сайті
              </Button>
              <Can permission={PermissionKeys.Catalog.EditProducts}>
                <Button type="submit" form={FORM_ID} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />} loading={saving}>
                  Зберегти товар
                </Button>
              </Can>
            </>
          ) : null
        }
      />

      {!data || !dictionariesSettled ? (
        !data && (product.status === 'error' || product.status === 'forbidden') ? (
          <PageState
            kind={product.status}
            title={product.problem?.status === 404 ? 'Товар не знайдено' : undefined}
            description={problemMessage(product.problem, 'Не вдалося завантажити товар.')}
            onRetry={product.problem?.status === 404 ? undefined : product.reload}
            action={
              <Button component={Link} to="/catalog/products" variant="subtle" size="sm">
                До списку товарів
              </Button>
            }
          />
        ) : (
          <PageState kind="loading" />
        )
      ) : (
        <div className="catalog-editor">
          {readOnly ? (
            <Alert className="catalog-editor-notice" color="gray" variant="light" icon={<IconLock size={18} />}>
              Лише перегляд: недостатньо прав для редагування товару.
            </Alert>
          ) : null}
          <div className="catalog-editor-grid">
            <div className="catalog-editor-main">
              <ProductEditorForm
                key={`${data.id}:${formKey}`}
                formId={FORM_ID}
                product={data}
                categories={categories}
                brands={brands}
                labels={labels}
                readOnly={readOnly}
                onBusy={setSaving}
                onSaved={saved}
              />
              <ProductEditorImages product={data} readOnly={readOnly} onChange={product.setData} />
            </div>
            <ProductEditorNavkolo product={data} />
          </div>
        </div>
      )}
    </>
  )
}
