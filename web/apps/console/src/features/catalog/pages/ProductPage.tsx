import { Alert, Button, Group } from '@mantine/core'
import { IconArchive, IconPackage, IconDeviceFloppy, IconLock } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Can, usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { CatalogEditorModal } from '../components/CatalogEditorModal'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { withCsrf } from '@/shared/api/csrf'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { ProductsPage } from './ProductsPage'
import { PageState } from '@/shared/ui/PageState'
import { getCategories, getProduct, setProductArchive, type Product } from '../api/catalogApi'
import { getBrands, getLabels } from '../api/dictionariesApi'
import { ProductEditorForm } from '../components/ProductEditorForm'
import { ProductEditorImages } from '../components/ProductEditorImages'
import { ProductEditorNavkolo } from '../components/ProductEditorNavkolo'
import { consoleCategoryOptions } from '../lib/categoryTree'
import { productName } from '../lib/productFilters'
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
  const [photosBusy, setPhotosBusy] = useState(false)
  const [opened, setOpened] = useState(true)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [moving, setMoving] = useState(false)
  const busy = saving || photosBusy || moving
  const navigate = useNavigate()
  const location = useLocation()
  const readOnly = Boolean(product.data?.isArchived) || !can(PermissionKeys.Catalog.EditProducts)

  const data = useMemo(() => (product.data?.id === id ? withUniqueImages(product.data) : undefined), [id, product.data])
  const name = data ? productName({ displayName: data.displayName, name: data.navkolo.name }) : 'Товар'

  function saved(next: Product) {
    product.setData(next)
    setFormKey(next.updatedAt)
  }

  async function changeArchive() {
    if (!data || moving || dirty) return
    setMoving(true)
    try {
      const result = await withCsrf(headers => setProductArchive(headers, data.id, !data.isArchived))
      if (result.response.ok) {
        setConfirmArchive(false)
        notifySuccess(data.isArchived ? 'Товар відновлено. Він прихований на вітрині.' : 'Товар перенесено в архів.')
        product.reload()
      } else notifyError(problemMessage(result.error, 'Не вдалося змінити стан товару.'))
    } catch {
      notifyError('Не вдалося зв’язатися з сервером.')
    } finally {
      setMoving(false)
    }
  }

  return (
    <>
      <ProductsPage />
      <CatalogEditorModal icon={IconPackage} title={name} className="product-editor-modal" size="wide" opened={opened} dirty={dirty}
        closeOnEscape={!busy && !confirmArchive} closeOnClickOutside={!busy && !confirmArchive}
        onClose={() => { if (!busy) setOpened(false) }}
        onExitTransitionEnd={() => {
          if (location.state?.fromProductList) navigate(-1)
          else navigate({ pathname: '/catalog/products', search: location.search }, { replace: true })
        }}
        footer={data && (
          <Group gap="xs" w="100%" justify="space-between">
            <Can permission={PermissionKeys.Catalog.EditProducts}>
              <Button variant="subtle" color="gray" disabled={dirty || busy} onClick={() => setConfirmArchive(true)} leftSection={<IconArchive size={16} />}>
                {data.isArchived ? 'Відновити з архіву' : 'До архіву'}
              </Button>
            </Can>
            {!readOnly && (
              <Button type="submit" form={FORM_ID} loading={saving} disabled={photosBusy || moving} leftSection={<IconDeviceFloppy size={16} />}>
                Зберегти товар
              </Button>
            )}
          </Group>
        )}
      >

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
          {data.isArchived ? <Alert color="gray">Товар в архіві.</Alert> : readOnly ? (
            <Alert className="catalog-editor-notice" color="gray" variant="light" icon={<IconLock size={18} />}>
              Лише перегляд: недостатньо прав для редагування товару.
            </Alert>
          ) : null}
          <ProductEditorNavkolo
            key={data.id}
            product={data}
            canUpdatePrice={!data.isArchived && can(PermissionKeys.Catalog.RunImport)}
            priceLoading={product.isFetching || busy}
            onReload={product.reload}
            onPriceSaved={product.setData}
          />
          <ProductEditorForm
            key={`${data.id}:${formKey}`}
            formId={FORM_ID}
            product={data}
            categories={categories}
            brands={brands}
            labels={labels}
            readOnly={readOnly}
            disabled={photosBusy || moving}
            onDirty={setDirty}
            onBusy={setSaving}
            onSaved={saved}
            gallery={<ProductEditorImages product={data} readOnly={readOnly}
              disabled={saving || moving} onBusy={setPhotosBusy} onChange={product.setData} />}
          />
        </div>
      )}
      </CatalogEditorModal>
      <ConfirmDialog opened={confirmArchive} busy={moving} title={data?.isArchived ? "Відновити товар?" : "Перенести товар до архіву?"}
        message={data?.isArchived ? "Товар повернеться до каталогу прихованим. Його можна буде показати на вітрині." : "Товар зникне з продажу. Історія замовлень і складські документи збережуться."}
        confirmLabel={data?.isArchived ? "Відновити" : "До архіву"} onClose={() => { if (!moving) setConfirmArchive(false) }} onConfirm={() => void changeArchive()} />
    </>
  )
}
