import { Alert, Button, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { getProducts } from '@/features/catalog/api/catalogApi'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { save, useRegister, type Ref } from './api'

export function StockOpeningForm({ close, saved }: { close: () => void; saved: () => void }) {
  const [id] = useState(() => crypto.randomUUID())
  const [orgId, setOrg] = useState<string | null>(null)
  const [storeId, setStore] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const [product, setProduct] = useState<Ref | null>(null)
  const [quantity, setQuantity] = useState('')
  const [reference, setReference] = useState('')
  const [day, setDay] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')
  const products = useApiQuery('opening-products:' + term, () => getProducts({ q: term, page: 1, pageSize: 25 }), {
    enabled: term.trim().length >= 2,
  })
  const items = (products.data?.items ?? []).map((p) => ({ value: p.id, label: p.name + ' · ' + p.sku }))
  if (product && !items.some((i) => i.value === product.id)) items.unshift({ value: product.id, label: product.title })
  const options = (refs: Ref[]) => refs.map((r) => ({ value: r.id, label: r.title }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !orgId || !storeId || !product) return
    setBusy(true)
    setError('')
    try {
      const result = await save('warehouse/openings', {
        id,
        orgId,
        storeId,
        productId: product.id,
        quantity: Number(quantity),
        day,
        reference,
      })
      if (result.response.ok) {
        saved()
        return
      }
      setError(problemMessage(result.error, 'Не вдалося ввести початковий залишок.'))
    } catch {
      setError('Перевірте з’єднання та повторіть збереження.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal opened onClose={busy ? () => {} : close} title="Початковий залишок">
      <form onSubmit={submit}>
        <Stack>
          <Select
            label="Організація"
            required
            data={options(refs.data?.organizations ?? [])}
            value={orgId}
            onChange={setOrg}
          />
          <Select label="Склад" required data={options(refs.data?.stores ?? [])} value={storeId} onChange={setStore} />
          <Select
            label="Товар"
            required
            searchable
            placeholder="Назва або артикул"
            searchValue={term}
            onSearchChange={setTerm}
            data={items}
            value={product?.id ?? null}
            onChange={(v, item) => setProduct(v && item ? { id: v, title: item.label } : null)}
          />
          <TextInput
            label="Звірена кількість"
            type="number"
            required
            min="0"
            max="1000000000"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.currentTarget.value)}
          />
          <TextInput label="На дату" type="date" required value={day} onChange={(e) => setDay(e.currentTarget.value)} />
          <TextInput
            label="Документ-підстава"
            placeholder="Номер інвентаризаційної відомості"
            maxLength={150}
            required
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
          {error && <Alert color="red">{error}</Alert>}
          <Button loading={busy} type="submit" disabled={!product || !orgId || !storeId}>
            Ввести залишок
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
