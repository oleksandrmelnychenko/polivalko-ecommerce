import { Alert, Button, FileInput, Loader, Text } from '@mantine/core'
import { IconAlertCircle, IconFileImport, IconFileUpload, IconRefresh } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PERMISSION_LABELS, PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getImportRuns, importCatalog, type ImportRun } from '../api/catalogApi'
import { ImportRunReport } from '../components/ImportRunReport'
import '../components/catalog.css'

export function ImportPage() {
  const { can } = usePermissions()
  const canViewRuns = can(PermissionKeys.Integration.ViewStatus)
  const canManageCategories = can(PermissionKeys.Catalog.ManageCategories)
  const runs = useApiQuery('catalog-import-runs', () => getImportRuns(), { enabled: canViewRuns })
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function upload(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!file || file.size === 0) {
      setError('Оберіть файл JSON або CSV.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    const data = new FormData()
    data.set('file', file)
    try {
      const response = await importCatalog(data)
      if (response.data) {
        setResult(response.data)
        if (canViewRuns) runs.reload()
      } else {
        setError(response.problem?.errors?.file?.[0] ?? (response.problem ? problemMessage(response.problem, 'Імпорт не виконано.') : 'Імпорт не виконано.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  const categoriesLink = canManageCategories ? (
    <Link to="/catalog/categories" className="catalog-link">
      категоріях
    </Link>
  ) : (
    'категоріях'
  )

  return (
    <>
      <PageHeader
        title="Імпорт товарів"
        heading={
          <span className="catalog-crumbs">
            <Link to="/catalog/products">Товари</Link>
            <span aria-hidden="true">/</span>
            <span className="catalog-crumbs-current">Імпорт з файлу</span>
          </span>
        }
      />
      <div className="catalog-page">
        <div className="catalog-import-grid">
          <section className="catalog-card" aria-labelledby="import-title">
            <h2 id="import-title" className="app-section-title catalog-card-title">
              Файл каталогу
            </h2>
            <form noValidate onSubmit={upload} aria-labelledby="import-title">
              <FileInput
                aria-label="Файл каталогу"
                placeholder="Оберіть файл JSON або CSV"
                accept=".json,.csv,application/json,text/csv"
                leftSection={<IconFileUpload size={16} stroke={1.7} />}
                clearable
                value={file}
                disabled={busy}
                description={
                  <>
                    CSV з колонками{' '}
                    <span className="catalog-code">navkolo_id; sku; name; group; price; old_price; stock; brand; variant_group; variant_label; description</span> або
                    JSON-масив тих самих полів. До 20 МБ.
                  </>
                }
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                onChange={(value) => {
                  setFile(value)
                  setError(null)
                }}
              />
              <div className="catalog-form-actions">
                <Button
                  type="submit"
                  leftSection={busy ? <Loader size={14} color="gray" /> : <IconFileImport size={16} stroke={1.8} />}
                  disabled={busy}
                  aria-busy={busy || undefined}
                >
                  {busy ? 'Імпортуємо…' : 'Імпортувати'}
                </Button>
              </div>
              {error ? (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" mt="sm">
                  {error}
                </Alert>
              ) : null}
            </form>
          </section>

          <aside className="catalog-card catalog-card-muted" aria-labelledby="import-rules-title">
            <h2 id="import-rules-title" className="app-section-title catalog-card-title">
              Що перезаписується
            </h2>
            <Text size="sm" c="gray.7" lh={1.55}>
              Артикул, назва з обліку, група, ціна, стара ціна й залишок. Опис, фото, характеристики, назва для вітрини й видимість задаються лише для нових
              товарів і далі не змінюються імпортом. Товари групи «Хлам» імпортуються прихованими. Групу з товарами без категорії на сайті прив&apos;яжіть у{' '}
              {categoriesLink}.
            </Text>
          </aside>
        </div>

        {result ? (
          <section className="catalog-import-result" aria-label="Результат імпорту">
            <ImportRunReport run={result} open />
          </section>
        ) : null}

        <section className="catalog-card catalog-runs" aria-labelledby="runs-title">
          <div className="catalog-card-head">
            <h2 id="runs-title" className="app-section-title catalog-card-title">
              Попередні імпорти
            </h2>
            {canViewRuns ? (
              <Button size="xs" variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} loading={runs.isFetching} onClick={runs.reload}>
                Оновити
              </Button>
            ) : null}
          </div>
          {!canViewRuns ? (
            <Text size="sm" c="dimmed">
              Історія імпортів доступна з правом «{PERMISSION_LABELS[PermissionKeys.Integration.ViewStatus]}».
            </Text>
          ) : runs.status === 'loading' ? (
            <PageState kind="loading" />
          ) : runs.status === 'error' || runs.status === 'forbidden' ? (
            <PageState kind={runs.status} description={problemMessage(runs.problem, 'Не вдалося завантажити історію імпортів.')} onRetry={runs.reload} />
          ) : (runs.data ?? []).length === 0 ? (
            <Text size="sm" c="dimmed">
              Імпортів ще не було.
            </Text>
          ) : (
            <div className="catalog-run-list">
              {(runs.data ?? []).map((run) => (
                <ImportRunReport key={run.id} run={run} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
