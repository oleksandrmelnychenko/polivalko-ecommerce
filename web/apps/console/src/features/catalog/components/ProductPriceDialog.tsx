import { Alert, Button, Stack, Text, TextInput } from '@mantine/core'
import { formatMoney } from '@polivalko/shared/lib/format'
import { useRef, useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { adjustProductPrice, getProduct, type Product } from '../api/catalogApi'

type ProductPriceDialogProps = { product: Product; onClose: () => void; onReload: () => void; onSaved: (product: Product) => void }

function parsePrice(input: string) {
  const normalized = input.trim().replace(',', '.')
  return /^\d{1,10}(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : null
}

export function ProductPriceDialog({ product, onClose, onReload, onSaved }: ProductPriceDialogProps) {
  const [current] = useState(() => product.navkolo)
  const [input, setInput] = useState(() => String(current.price.value))
  const [compareInput, setCompareInput] = useState(() => String(current.oldPrice?.value ?? ''))
  const [error, setError] = useState<string | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const price = parsePrice(input)
  const oldPrice = parsePrice(compareInput)
  const expectedPrice = Number(current.price.value)
  const expectedOldPrice = current.oldPrice ? Number(current.oldPrice.value) : null

  const invalidCompare = Boolean(compareInput.trim()) && oldPrice === null
  const unchanged = price === expectedPrice && oldPrice === expectedOldPrice

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || needsReload || price === null || invalidCompare || unchanged) return
    setError(null)
    submitting.current = true
    setBusy(true)

    try {
      const { response, data, error: failure } = await withCsrf(headers => adjustProductPrice(headers, {
        productId: product.id,
        expectedSku: current.sku,
        expectedPrice,
        expectedOldPrice,
        expectedPriceUpdatedAt: current.priceUpdatedAt,
        price,
        replaceOldPrice: true,
        oldPrice,
      }))

      if (response.ok && data?.updated === 1) {
        const { data: updated } = await getProduct(product.id, 'no-store')
        const verified = updated?.navkolo
        if (!updated || updated.id !== product.id || !verified || verified.sku !== current.sku ||
          verified.price.currency !== current.price.currency || Number(verified.price.value) !== price ||
          (verified.oldPrice ? Number(verified.oldPrice.value) : null) !== oldPrice ||
          verified.priceUpdatedAt === current.priceUpdatedAt) {
          setNeedsReload(true)
          setError('Результат збереження потребує перевірки. Оновіть картку.')
          return
        }
        onSaved(updated)
        return
      }
      if (response.status === 409) {
        setNeedsReload(true)
        setError('Товар, ціна або умови знижки відрізняються. Оновіть картку й перевірте ціну.')
        return
      }
      setNeedsReload(true)
      setError(fieldErrors(failure).changes ?? problemMessage(failure, 'Результат збереження потребує перевірки. Оновіть картку.'))
    } catch {
      setNeedsReload(true)
      setError('Результат збереження потребує перевірки. Оновіть картку.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <AppModal opened title="Змінити роздрібну ціну" closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy} onClose={onClose}>
      <form onSubmit={submit} aria-busy={busy}>
        <Stack gap="sm">
          <Text size="sm">Артикул {current.sku}. Поточна ціна {formatMoney(current.price)}.</Text>
          <TextInput
            label="Нова роздрібна ціна, грн"
            inputMode="decimal"
            value={input}
            disabled={busy || needsReload}
            error={price === null && input.trim() ? 'Введіть суму з точністю до двох знаків після коми.' : undefined}
            onChange={event => setInput(event.currentTarget.value)}
            data-autofocus
          />
          <TextInput label="Попередня ціна, грн" placeholder="Без попередньої ціни" inputMode="decimal"
            value={compareInput} disabled={busy || needsReload}
            error={invalidCompare ? 'Введіть суму з точністю до двох знаків після коми.' : undefined}
            onChange={event => setCompareInput(event.currentTarget.value)} />
          {error ? <Alert color="red" role="alert">{error}</Alert> : null}
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={onClose}>Скасувати</Button>
          {needsReload ? (
            <Button onClick={() => { onReload(); onClose() }}>Оновити картку</Button>
          ) : (
            <Button type="submit" loading={busy} disabled={price === null || invalidCompare || unchanged}>Зберегти ціну</Button>
          )}
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
