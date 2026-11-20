import { Alert, Button, NumberInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { adjustProductStock, type Product } from '../api/catalogApi'

export function ProductStockDialog({ product, onClose, onReload }: { product: Product; onClose: () => void; onReload: () => void }) {
  const [before] = useState(product.navkolo)
  const [value, setValue] = useState<number | string>(before.stock)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || conflict || typeof value !== 'number' || value < 0 || value === before.stock) return
    setBusy(true)
    try {
      const result = await withCsrf(headers => adjustProductStock(headers, {
        productId: product.id, expectedNavkoloId: before.navkoloId, expectedStockUpdatedAt: before.stockUpdatedAt, expectedQuantity: before.stock, quantity: value,
      }))
      if (result.response.ok) {
        notifySuccess('Залишок оновлено.')
        onReload()
        onClose()
      } else if (result.response.status === 409) {
        const reason = result.error && 'conflicts' in result.error ? result.error.conflicts[0]?.reason : undefined
        setError(reason === 'warehouse_managed' ? 'Цей залишок змінюється складським документом.' : reason === 'reserved_stock' ? 'Кількість менша за зарезервовану.' : 'Залишок змінився. Відкрийте редагування ще раз.')
        setConflict(reason !== 'reserved_stock')
        onReload()
      } else setError(problemMessage(result.error, 'Не вдалося зберегти залишок.'))
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AppModal opened title="Змінити залишок" onClose={() => { if (!busy) onClose() }}>
      <form onSubmit={submit}>
        <NumberInput label="Кількість на складі" min={0} max={999999999.999} decimalScale={3} value={value} onChange={setValue} data-autofocus />
        {error && <Alert color="red" role="alert" mt="sm">{error}</Alert>}
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={onClose}>Скасувати</Button>
          <Button type="submit" loading={busy} disabled={conflict || typeof value !== 'number' || value === before.stock}>Зберегти залишок</Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
