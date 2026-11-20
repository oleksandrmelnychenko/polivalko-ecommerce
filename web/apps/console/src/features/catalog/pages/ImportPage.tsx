import { Alert, Button, Text } from '@mantine/core'
import { IconAlertCircle, IconFileImport, IconHelpCircle, IconHistory, IconRefresh } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PERMISSION_LABELS, PermissionKeys } from '@/shared/auth/permissionKeys'
import { siteUrl } from '@/shared/lib/siteUrl'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getImportRuns, importCatalog, type ImportRun } from '../api/catalogApi'
import { ImportRunReport } from '../components/ImportRunReport'
import { StockImportForm } from '../components/StockImportForm'
import { ImportFilePicker } from '../components/ImportFilePicker'
import { CatalogEditorModal } from '../components/CatalogEditorModal'
import '../components/catalog.css'
import '../components/catalog-import.css'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const TOO_LARGE = 'Файл завеликий: до 20 МБ.'

export function ImportPage() {
  const { can } = usePermissions()
  const canViewRuns = can(PermissionKeys.Integration.ViewStatus)
  const canManageCategories = can(PermissionKeys.Catalog.ManageCategories)
  const canImportStock = can(PermissionKeys.Catalog.ViewProducts) && can(PermissionKeys.Catalog.RunImport)
  const runs = useApiQuery('catalog-import-runs', () => getImportRuns(), { enabled: canViewRuns })
  const [helpOpened, setHelpOpened] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function upload(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!file || file.size === 0) {
      setError(file ? 'Файл порожній. Оберіть файл JSON або CSV з товарами.' : 'Оберіть файл JSON або CSV.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(TOO_LARGE)
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
      } else if (response.response.status === 413) {
        setError(TOO_LARGE)
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
      <PageHeader title="Імпорт товарів" />
      <div className="import-page">
        <div className="catalog-import-grid">
          <section className="catalog-card import-card" aria-labelledby="import-title">
            <h2 id="import-title" className="import-heading"><IconFileImport aria-hidden="true" />Імпорт товарів</h2>
            <form noValidate onSubmit={upload} aria-labelledby="import-title">
              <ImportFilePicker label="Файл каталогу" hint="CSV або JSON · до 20 МБ"
                accept=".json,.csv,application/json,text/csv" file={file} disabled={busy}
                onChange={value => { setFile(value); setError(null) }} />
              <div className="import-actions">
                <Button variant="subtle" color="gray" size="xs" leftSection={<IconHelpCircle size={16} />}
                  onClick={() => setHelpOpened(true)}>Формат файлу</Button>
                <Button type="submit" loading={busy} disabled={!file}>Імпортувати</Button>
              </div>
              {error ? (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" mt="sm">
                  {error}
                </Alert>
              ) : null}
            </form>
          </section>

          {canImportStock && <StockImportForm />}
        </div>

        <CatalogEditorModal icon={IconFileImport} title="Формат файлу каталогу" opened={helpOpened} onClose={() => setHelpOpened(false)}>
          <div className="import-guide">
            <h3>CSV</h3>
            <p>Кодування UTF-8. Роздільник колонок — кома або крапка з комою.</p>
            <code>navkolo_id;sku;name;group;price;old_price;stock;brand;variant_group;variant_label;description</code>
            <h3>JSON</h3>
            <p>Масив товарів із полями <code>navkoloId</code>, <code>sku</code>, <code>name</code>, <code>groupRef</code>, <code>price</code> і <code>stock</code>.</p>
            <h3>Що оновиться</h3>
            <p>Для наявних товарів імпорт оновлює артикул, облікову назву, групу, ціни та залишок. Опис, фото й характеристики додаються під час створення товару.</p>
            <p>Нові товари групи «Хлам» додаються прихованими. Відповідність груп можна налаштувати в {categoriesLink}.</p>
          </div>
        </CatalogEditorModal>

        {result ? (
          <section className="catalog-card catalog-import-result" aria-label="Результат імпорту">
            <h2 className="import-heading"><IconFileImport aria-hidden="true" />Результат імпорту</h2>
            <ImportRunReport run={result} open />
            <a className="catalog-link" href={siteUrl('/catalog')} target="_blank" rel="noopener">
              Відкрити каталог магазину
            </a>
          </section>
        ) : null}

        <section className="catalog-card catalog-runs" aria-labelledby="runs-title">
          <div className="catalog-card-head">
            <h2 id="runs-title" className="import-heading">
              <IconHistory aria-hidden="true" />Попередні імпорти
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
