import { Alert, Button, Checkbox, FileInput, Stack, Text } from '@mantine/core'
import { IconFileUpload } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { apiFetch } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'

const MAX_ROWS = 200
const MAX_FILE_BYTES = 1024 * 1024
const INVALID_FILE = 'Оберіть JSON-файл зі списком categories (до 200 категорій).'

type CategoryInput = { name: string; slug: string; parentSlug: string | null; navkoloRef: string }
type ImportResult = { created: number; unchanged: number }
type CategoryImportDialogProps = { onClose: () => void; onImported: () => void }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function isCategory(value: unknown): value is CategoryInput {
  return isRecord(value) && Object.keys(value).length === 4 &&
    isText(value.name, 200) && isText(value.slug, 200) &&
    (value.parentSlug === null || isText(value.parentSlug, 200)) && isText(value.navkoloRef, 100)
}

function isResult(value: unknown, count: number): value is ImportResult {
  return isRecord(value) && typeof value.created === 'number' && typeof value.unchanged === 'number' &&
    Number.isInteger(value.created) && Number.isInteger(value.unchanged) &&
    value.created >= 0 && value.unchanged >= 0 && value.created + value.unchanged === count
}

export function CategoryImportDialog({ onClose, onImported }: CategoryImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [prepared, setPrepared] = useState<CategoryInput[] | null>(null)
  const [showOnStorefront, setShowOnStorefront] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const submitting = useRef(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || !file) return
    setError(null)
    setResult(null)
    if (!file.size || file.size > MAX_FILE_BYTES) {
      setError('Оберіть непорожній JSON-файл розміром до 1 МБ.')
      return
    }

    submitting.current = true
    setBusy(true)
    try {
      if (!prepared) {
        const body: unknown = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
        if (!isRecord(body) || Object.keys(body).length !== 1 || !Array.isArray(body.categories) ||
          body.categories.length === 0 || body.categories.length > MAX_ROWS || !body.categories.every(isCategory)) {
          setError(INVALID_FILE)
          return
        }
        setPrepared(body.categories)
        return
      }

      const { response, payload } = await withCsrf(async headers => {
        const response = await apiFetch('/api/v1/console/catalog/categories/import', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: prepared, showOnStorefront }),
        })
        const payload: unknown = await response.json().catch(() => null)
        return { response, payload, error: response.ok ? undefined : payload }
      })
      setPrepared(null)
      if (response.ok && isResult(payload, prepared.length)) {
        setResult(payload)
        setFile(null)
        onImported()
      } else if (response.status === 409) {
        setError('Категорії не імпортовано. Звірте адреси, батьківські категорії та групи Navkolo з наявними записами.')
      } else {
        setError(fieldErrors(payload).categories ?? problemMessage(payload, 'Не вдалося підтвердити імпорт. Оновіть список категорій і перевірте файл.'))
      }
    } catch (failure) {
      setPrepared(null)
      setError(!prepared && failure instanceof SyntaxError ? INVALID_FILE :
        'Не вдалося підтвердити імпорт. Оновіть список категорій і перевірте файл.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <AppModal opened title="Імпорт категорій" closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy} onClose={onClose}>
      <form onSubmit={submit} aria-busy={busy}>
        <Stack gap="md">
          {prepared ? (
            <>
              <Text size="sm">Записів у файлі {prepared.length}.</Text>
              <Checkbox
                label="Показувати нові категорії на сайті"
                description="Для показу мають бути видимі всі батьківські категорії. Групи Navkolo зі списку прихованих залишаються прихованими."
                checked={showOnStorefront}
                disabled={busy}
                onChange={event => setShowOnStorefront(event.currentTarget.checked)}
              />
            </>
          ) : (
            <FileInput
              label="Файл категорій"
              description="JSON зі списком categories і полями name, slug, parentSlug, navkoloRef. До 200 категорій, 1 МБ."
              placeholder="Оберіть файл JSON"
              accept=".json,application/json"
              leftSection={<IconFileUpload size={16} stroke={1.7} />}
              clearable
              value={file}
              disabled={busy}
              onChange={value => {
                setFile(value)
                setShowOnStorefront(true)
                setError(null)
                setResult(null)
              }}
            />
          )}
          {error ? <Alert color="red" role="alert">{error}</Alert> : null}
          {result ? <Alert color="green" role="status">Створено категорій {result.created}. Уже в каталозі {result.unchanged}.</Alert> : null}
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={prepared ? () => setPrepared(null) : onClose}>
            {prepared ? 'Назад' : 'Закрити'}
          </Button>
          <Button type="submit" loading={busy} disabled={!file}>
            {prepared ? 'Імпортувати категорії' : 'Перевірити файл'}
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
