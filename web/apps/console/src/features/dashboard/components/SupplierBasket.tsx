import { Button } from '@mantine/core'
import { useEffect, useState } from 'react'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import type { BudgetItem, PurchaseSeason, SupplierGroup } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

type Picked = { id: string; supplier: string | null; name: string; unit: string; quantity: number | null }
type Line = { item: BudgetItem; quantity: number; amount: number | null }

export function seasonText(season?: PurchaseSeason | null) {
  if (!season) return 'Поточний темп · недостатньо сезонної історії'
  const basis = season.source === 'product' ? 'товару' : 'категорії'
  return 'Сезонність ' + basis + ' × ' + numberFormat.format(season.factor) + ' · сезони: ' + season.years
}

function readCart(key: string): Picked[] {
  const data: unknown = JSON.parse(localStorage.getItem(key) || '[]')
  if (!Array.isArray(data)) return []
  return data.filter(row => row && typeof row.id === 'string' && typeof row.name === 'string'
    && typeof row.unit === 'string' && (row.supplier === null || typeof row.supplier === 'string')
    && (row.quantity === null || (Number.isFinite(row.quantity) && row.quantity > 0)))
}

export function useSupplierBasket(account: string) {
  const key = 'polivalko:supplier-basket:v1:' + account
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Picked[]>(() => {
    try { return readCart(key) } catch { return [] }
  })
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === key || event.key === null) {
        try { setPicked(readCart(key)) } catch { setError('Не вдалося прочитати збережений кошик.') }
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])

  function save(change: (prior: Picked[]) => Picked[]) {
    try {
      const next = change(readCart(key))
      localStorage.setItem(key, JSON.stringify(next))
      setPicked(next)
      setError('')
    } catch { setError('Браузер не зміг зберегти зміни кошика.') }
  }
  function add(groups: SupplierGroup[]) {
    save(prior => {
      const rows = new Map(prior.map(row => [row.id, row]))
      for (const group of groups) for (const item of group.items) {
        const existing = rows.get(item.id)
        if (existing && existing.supplier === group.id && existing.unit === item.unit) continue
        rows.set(item.id, { id: item.id, name: item.name, supplier: group.id, unit: item.unit, quantity: null })
      }
      return [...rows.values()]
    })
  }
  return { picked, error, add,
    remove: (id: string) => save(prior => prior.filter(row => row.id !== id)),
    setQuantity: (id: string, quantity: number | null) => save(prior => prior.map(row => row.id === id ? { ...row, quantity } : row)),
  }
}

export type Basket = ReturnType<typeof useSupplierBasket>

function lineAmount(item: BudgetItem, quantity: number) {
  if (item.quantity === quantity) return item.amount
  if (item.unitPrice === null) return null
  return Number((Math.round(Number((item.unitPrice * quantity * 100).toFixed(8))) / 100).toFixed(2))
}

function subtotal(lines: Line[]) {
  return lines.reduce((cents, line) => cents + Math.round((line.amount ?? 0) * 100), 0) / 100
}

function download(group: SupplierGroup, lines: Line[], through: string, days: number, cover: number, seasonal: boolean) {
  const text = [
    'Чернетка замовлення · ' + group.name, dateLabel(through),
    'Продажі за ' + days + ' днів · запас на ' + cover + ' днів · ' + (seasonal ? 'з урахуванням сезону' : 'за поточним темпом'),
    ...lines.map(({ item, quantity, amount }) => [item.sku, item.name, numberFormat.format(quantity) + ' ' + item.unit,
      item.unitPrice === null ? 'Ціну уточнити' : numberFormat.format(item.unitPrice) + ' грн/' + item.unit,
      item.priceDay && dateLabel(item.priceDay), amount === null ? '' : formatPrice(amount)].filter(Boolean).join(' · ')),
    'Оцінено на ' + formatPrice(subtotal(lines)) + ' · без ціни ' + lines.filter(line => line.amount === null).length,
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = ('Замовлення ' + group.name + ' ' + through).replace(/[<>:"/\\|?*]/g, '-') + '.txt'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SupplierBasket({ basket, groups, days, cover, through, seasonal }: {
  basket: Basket; groups: SupplierGroup[]; days: number; cover: number; through: string; seasonal: boolean
}) {
  const selected = new Map(basket.picked.map(row => [row.id, row]))
  const matched = new Set<string>()
  const orders = groups.map(group => {
    const lines: Line[] = []
    for (const item of group.items) {
      const row = selected.get(item.id)
      if (!row || row.supplier !== group.id || row.unit !== item.unit) continue
      matched.add(item.id)
      const quantity = row.quantity ?? item.quantity
      lines.push({ item, quantity, amount: lineAmount(item, quantity) })
    }
    return { group, lines }
  }).filter(order => order.lines.length)
  const lines = orders.flatMap(order => order.lines)
  const missing = lines.filter(line => line.amount === null).length
  const outdated = basket.picked.filter(row => !matched.has(row.id))
  return <details className="dash-supplier-cart">
    <summary>Кошик постачальників <TableChip tone="document" value={`${numberFormat.format(lines.length)} поз.`} /> · {formatPrice(subtotal(lines))}
      {missing > 0 && ' + без ціни: ' + missing}{outdated.length > 0 && ' · перевірити: ' + outdated.length}</summary>
    <p>Чернетка зберігається у цьому браузері для вашого облікового запису. Рекомендовані кількості оновлюються з чергою. Кількість, введена вручну, зберігається.</p>
    <Button variant="default" size="compact-xs" disabled={!groups.some(group => group.items.some(item => !matched.has(item.id)))}
      onClick={() => basket.add(groups)}>Додати всю чергу</Button>
    {orders.map(({ group, lines: items }) => <section className="dash-cart-order" key={group.id ?? 'unknown'}>
      <h4>{group.name || 'Уточнити постачальника'} · {formatPrice(subtotal(items))}</h4>
      <ul>{items.map(({ item, quantity, amount }) => <li key={item.id}>
        <strong>{item.name}</strong>
        <small>{item.sku} · Рекомендовано {numberFormat.format(item.quantity)} {item.unit}{seasonal && ' · ' + seasonText(item.season)}</small>
        {item.priceDay && item.receiptId && <small><DocumentLink id={item.receiptId}>Ціна від {dateLabel(item.priceDay)}</DocumentLink></small>}
        <div className="dash-cart-actions">
          <label>Замовити, {item.unit} <input type="number" aria-label={'Кількість для ' + item.name} key={quantity}
            min={item.unit === 'шт' ? 1 : 0.001} max={1000000000} step={item.unit === 'шт' ? 1 : 0.001} defaultValue={quantity}
            onBlur={event => {
              const field = event.currentTarget
              if (field.value && field.validity.valid && field.valueAsNumber !== quantity) basket.setQuantity(item.id, field.valueAsNumber)
              else field.value = String(quantity)
            }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
          <b>{amount === null ? 'Ціну уточнити' : formatPrice(amount)}</b>
          {selected.get(item.id)?.quantity != null && <button type="button" onClick={() => basket.setQuantity(item.id, null)}>За рекомендацією</button>}
          <button type="button" onClick={() => basket.remove(item.id)}>Прибрати</button>
        </div>
      </li>)}</ul>
      {group.id && <Button size="compact-xs" variant="default" onClick={() => download(group, items, through, days, cover, seasonal)}>Завантажити замовлення</Button>}
    </section>)}
    {outdated.length > 0 && <section className="dash-cart-order"><h4>Поза поточною чергою · виключено із суми</h4>
      {outdated.map(row => <div key={row.id}>{row.name} <button type="button" onClick={() => basket.remove(row.id)}>Прибрати</button></div>)}
    </section>}
  </details>
}
