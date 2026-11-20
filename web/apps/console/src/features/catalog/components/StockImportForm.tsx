import { Alert, Button, FileInput, Text } from '@mantine/core'
import { IconAlertCircle, IconFileUpload } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { apiFetch } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { Product } from '../api/catalogApi'

const PRODUCTS = '/api/v1/console/catalog/products'
const MAX_CHANGES = 200
const MAX_FILE_BYTES = 1024 * 1024
const PREFLIGHT_BATCH_SIZE = 3
const INVALID_FILE = 'Оберіть JSON-файл із коректним списком changes (до 200 товарів).'

type StockChange = {
  productId: string
  expectedNavkoloId: string
  expectedQuantity: number
  expectedStockUpdatedAt: string
  quantity: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stockTimestamp(value: string): string | null {
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!parts) return null
  const epoch = Date.parse(parts[1] + parts[3])
  return Number.isFinite(epoch) ? `${epoch}:${(parts[2] ?? '').padEnd(7, '0')}` : null
}

function isQuantity(value: unknown): value is number {
  return typeof value === 'number' && value <= 999999999.999 && /^\d+(\.\d{1,3})?$/.test(String(value))
}

function isStockChange(value: unknown): value is StockChange {
  return isRecord(value) && Object.keys(value).length === 5 &&
    typeof value.productId === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value.productId) &&
    typeof value.expectedNavkoloId === 'string' && value.expectedNavkoloId.trim().length > 0 && value.expectedNavkoloId.length <= 100 &&
    typeof value.expectedStockUpdatedAt === 'string' && stockTimestamp(value.expectedStockUpdatedAt) !== null &&
    isQuantity(value.expectedQuantity) && isQuantity(value.quantity)
}

async function stockMatches(change: StockChange): Promise<boolean> {
  const response = await apiFetch(`${PRODUCTS}/${encodeURIComponent(change.productId)}`, { cache: 'no-store' })
  if (response.status === 404) return false
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null)
    throw new Error(problemMessage(error, 'Не вдалося перевірити поточний залишок.'))
  }
  const { navkolo }: Product = await response.json()
  const currentTimestamp = stockTimestamp(navkolo.stockUpdatedAt)
  return navkolo.navkoloId === change.expectedNavkoloId && navkolo.stock === change.expectedQuantity &&
    currentTimestamp !== null && currentTimestamp === stockTimestamp(change.expectedStockUpdatedAt)
}

export function StockImportForm() {
  const [file, setFile] = useState<File | null>(null)
  const [checked, setChecked] = useState<StockChange[] | null>(null)
  const [busy, setBusy] = useState<'check' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function checkFile(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError(null)
    setSuccess(null)
    if (!file?.size || file.size > MAX_FILE_BYTES) {
      setError('Оберіть непорожній JSON-файл розміром до 1 МБ.')
      return
    }

    setBusy('check')
    try {
      const payload: unknown = JSON.parse(await file.text().catch(() => '').then(text => text.replace(/^\uFEFF/, '')))
      if (!isRecord(payload) || Object.keys(payload).length !== 1 || !Array.isArray(payload.changes) ||
        payload.changes.length === 0 || payload.changes.length > MAX_CHANGES || !payload.changes.every(isStockChange)) {
        setError(INVALID_FILE)
        return
      }
      if (new Set(payload.changes.map(change => change.productId.toLowerCase())).size !== payload.changes.length) {
        setError('Файл має містити кожен товар лише один раз.')
        return
      }
      const changes = payload.changes.filter(change => change.expectedQuantity !== change.quantity)
      if (!changes.length) {
        setSuccess('У файлі немає змін залишків.')
        return
      }
      let conflicts = 0
      for (let offset = 0; offset < changes.length; offset += PREFLIGHT_BATCH_SIZE) {
        const batch = await Promise.all(changes.slice(offset, offset + PREFLIGHT_BATCH_SIZE).map(stockMatches))
        conflicts += batch.filter(matches => !matches).length
      }
      if (conflicts) {
        setError(`Не збігаються поточні дані для ${conflicts} товарів. Оновіть файл і повторіть перевірку.`)
      } else {
        setChecked(changes)
      }
    } catch (failure) {
      setError(failure instanceof SyntaxError ? INVALID_FILE : failure instanceof TypeError ? NETWORK_ERROR :
        failure instanceof Error ? failure.message : 'Не вдалося перевірити файл.')
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (!checked || busy) return
    setBusy('apply')
    try {
      const { response, payload } = await withCsrf(async headers => {
        const response = await apiFetch(`${PRODUCTS}/stock`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: checked }),
        })
        const payload: unknown = await response.json().catch(() => null)
        return { response, payload, error: response.ok ? undefined : payload }
      })

      if (response.ok && isRecord(payload) && payload.updated === checked.length) {
        setFile(null)
        setSuccess(`Оновлено залишки товарів: ${payload.updated}.`)
      } else if (response.status === 409) {
        const conflicts = isRecord(payload) && Array.isArray(payload.conflicts) ? payload.conflicts : []
        const reasons = conflicts.filter(isRecord).map(conflict => conflict.reason)
        const reserved = reasons.filter(reason => reason === 'reserved_stock').length
        const stale = reasons.filter(reason => reason === 'stock_changed' || reason === 'missing_product').length
        setError([
          'Зміни не застосовано.',
          conflicts.length ? `Конфлікти для ${conflicts.length} товарів.` : 'Виявлено конфлікт залишків.',
          reserved ? `Новий залишок менший за резерв у ${reserved} товарів.` : '',
          stale ? `Залишки змінилися або товар відсутній у ${stale} позиціях.` : '',
          'Перевірте актуальні залишки й резерви.',
        ].filter(Boolean).join(' '))
      } else {
        setError(problemMessage(payload, 'Не вдалося підтвердити результат. Повторіть перевірку файлу.'))
      }
    } catch {
      setError('Не вдалося підтвердити результат. Повторіть перевірку файлу.')
    } finally {
      setChecked(null)
      setBusy(null)
    }
  }

  return (
    <section className="catalog-card" aria-labelledby="stock-import-title">
      <h2 id="stock-import-title" className="app-section-title catalog-card-title">Оновлення залишків</h2>
      <form onSubmit={checkFile}>
        <FileInput
          aria-label="Файл залишків"
          placeholder="Оберіть файл JSON"
          accept=".json,application/json"
          leftSection={<IconFileUpload size={16} stroke={1.7} />}
          description="Файл із підготовленими змінами залишків. До 200 товарів, 1 МБ."
          clearable
          value={file}
          disabled={busy !== null || checked !== null}
          onChange={value => {
            setFile(value)
            setError(null)
            setSuccess(null)
          }}
        />
        <div className="catalog-form-actions">
          <Button type="submit" disabled={!file || checked !== null || busy !== null} loading={busy === 'check'}>
            Перевірити залишки
          </Button>
        </div>
        {error ? <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" mt="sm">{error}</Alert> : null}
        {success ? <Text size="sm" role="status" mt="sm">{success}</Text> : null}
      </form>
      <ConfirmDialog
        opened={checked !== null}
        title="Підтвердьте оновлення залишків"
        message={`Зміниться залишок для ${checked?.length ?? 0} товарів. Сервер повторно перевірить поточні залишки й резерви перед оновленням.`}
        confirmLabel="Оновити залишки"
        busy={busy === 'apply'}
        onConfirm={apply}
        onClose={() => setChecked(null)}
      />
    </section>
  )
}
