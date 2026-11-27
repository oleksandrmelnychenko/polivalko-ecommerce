import { Alert, Button, NumberInput, Text } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
  const linkedWarehouse = product.warehouseStoreId != null
  const reserved = product.reservedQuantity ?? 0
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (linkedWarehouse || busy || conflict || typeof value !== 'number' || value < reserved || value === before.stock) return
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
        {linkedWarehouse ? (
          <Alert color="blue" mb="sm">
            Товар прив’язаний до складу{product.warehouseStoreTitle ? ` «${product.warehouseStoreTitle}»` : ''}. Змінюйте залишок складськими документами у розділі{' '}
            <Link to={`/warehouse/stock?q=${encodeURIComponent(before.sku)}`}>Склад → Залишки</Link>.
          </Alert>
        ) : (
          <>
            <NumberInput
              label="Кількість на складі"
              min={reserved}
              max={999999999.999}
              decimalScale={3}
              value={value}
              onChange={setValue}
              data-autofocus
            />
            {reserved > 0 && (
              <Text size="xs" c="dimmed" mt={6}>
                У резерві замовлень: {new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 }).format(reserved)}. Залишок не може бути меншим за резерв.
              </Text>
            )}
          </>
        )}
        {error && <Alert color="red" role="alert" mt="sm">{error}</Alert>}
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={onClose}>Скасувати</Button>
          {!linkedWarehouse && (
            <Button type="submit" loading={busy} disabled={conflict || typeof value !== 'number' || value < reserved || value === before.stock}>
              Зберегти залишок
            </Button>
          )}
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
