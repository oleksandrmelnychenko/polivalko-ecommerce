import { Button } from '@mantine/core'
import { IconChevronDown, IconDownload, IconFileInvoice, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import type { BudgetItem, PurchaseSeason, SupplierGroup } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

// The same precision as the unit price on screen, so the downloaded order repeats it exactly.
const priceFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 6 })

type Picked = { id: string; supplier: string | null; name: string; unit: string; quantity: number | null }
type Line = { item: BudgetItem; quantity: number; amount: number | null }

export function SeasonIndicator({ season }: { season?: PurchaseSeason | null }) {
  if (!season) return <span className="dash-season-indicator"><TableChip value="Поточний темп" /><small>Недостатньо сезонної історії</small></span>
  const product = season.source === 'product'
  return <span className="dash-season-indicator">
    <TableChip tone={product ? 'product' : 'source'} value={`Сезонність ${product ? 'товару' : 'категорії'} × ${numberFormat.format(season.factor)}`} />
    <small>Сезонів · {numberFormat.format(season.years)}</small>
  </span>
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

// Pieces, and the placeholder for a unit nobody names, are ordered whole; the plan rounds them the same way.
const wholeUnits = (unit: string) => unit === 'шт' || unit === 'од'

function lineAmount(item: BudgetItem, quantity: number) {
  if (item.quantity === quantity) return item.amount
  if (item.unitPrice === null) return null
  return Number((Math.round(Number((item.unitPrice * quantity * 100).toFixed(8))) / 100).toFixed(2))
}

function subtotal(lines: Line[]) {
  return lines.reduce((cents, line) => cents + Math.round((line.amount ?? 0) * 100), 0) / 100
}

// A line without a price adds nothing to the sum, so the total has to say how many lines it leaves out.
function orderTotal(lines: Line[]) {
  const unpriced = lines.filter(line => line.amount === null).length
  if (unpriced === lines.length) return 'Сума невідома'
  return formatPrice(subtotal(lines)) + (unpriced ? ' + без ціни: ' + unpriced : '')
}

function download(group: SupplierGroup, lines: Line[], through: string, days: number, cover: number, seasonal: boolean) {
  const text = [
    'Чернетка замовлення · ' + group.name, dateLabel(through),
    'Продажі за ' + days + ' днів · запас на ' + cover + ' днів · ' + (seasonal ? 'з урахуванням сезону' : 'за поточним темпом'),
    ...lines.map(({ item, quantity, amount }) => [item.sku, item.name, numberFormat.format(quantity) + ' ' + item.unit,
      item.unitPrice === null ? 'Ціну уточнити' : priceFormat.format(item.unitPrice) + ' грн/' + item.unit,
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
      if (!row || row.supplier !== group.id || row.unit !== item.unit || matched.has(item.id)) continue
      matched.add(item.id)
      const quantity = row.quantity ?? item.quantity
      lines.push({ item, quantity, amount: lineAmount(item, quantity) })
    }
    const remaining = group.items.filter(item => !matched.has(item.id))
    return { group, lines, remaining }
  }).filter(order => order.lines.length)
  const lines = orders.flatMap(order => order.lines)
  const missing = lines.filter(line => line.amount === null).length
  const outdated = [...selected.values()].filter(row => !matched.has(row.id))
  // A saved line can fall out of the sum for two reasons: the product left the queue, or it is still
  // there under another supplier or unit. Only the first one is "outside the queue".
  const queued = new Map(groups.flatMap(group => group.items.map(item => [item.id, { group, item }] as const)))
  const changed = outdated.filter(row => queued.has(row.id))
  const gone = outdated.filter(row => !queued.has(row.id))
  const allAdded = groups.every(group => group.items.every(item => matched.has(item.id)))
  const matchesPlan = lines.length > 0 && allAdded && outdated.length === 0
    && lines.every(line => line.quantity === line.item.quantity)
  return <details className="dash-supplier-cart">
    <summary>Кошик постачальників <TableChip tone="document" value={`${numberFormat.format(lines.length)} поз.${matchesPlan ? ' за рекомендацією' : ''}`} />
      {missing > 0 && <TableChip tone="warning" value={`Без ціни · ${missing}`} />}{outdated.length > 0 && <TableChip tone="warning" value={`Перевірити · ${outdated.length}`} />}
      {!matchesPlan && lines.length > 0 && <strong>{lines.length === missing ? 'Сума невідома' : formatPrice(subtotal(lines))}</strong>}
      <IconChevronDown size={16} aria-hidden="true" /></summary>
    {!allAdded && <Button variant="default" size="compact-xs"
      onClick={() => basket.add(groups)}>Додати всю чергу</Button>}
    {orders.map(({ group, lines: items, remaining }) => <details className="dash-cart-order" key={group.id ?? 'unknown'}>
      <summary><span>{group.name || 'Уточнити постачальника'}</span><strong>{orderTotal(items)}</strong><IconChevronDown size={15} aria-hidden="true" /></summary>
      <ul>{items.map(({ item, quantity, amount }) => <li key={item.id}>
        <Link className="dash-budget-product" to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
        <div className="dash-cart-meta">{item.sku && <small>Артикул {item.sku}</small>}<TableChip tone="storage" value={`Рекомендовано ${numberFormat.format(item.quantity)} ${item.unit}`} />
          {seasonal && <SeasonIndicator season={item.season} />}</div>
        {item.priceDay && item.receiptId && <DocumentLink className="dash-receipt-pill" id={item.receiptId}><IconFileInvoice size={14} aria-hidden="true" />Накладна від {dateLabel(item.priceDay)}</DocumentLink>}
        <div className="dash-cart-actions">
          <label>Замовити, {item.unit} <input type="number" data-basket-item={item.id} aria-label={'Кількість для ' + item.name} key={quantity}
            min={wholeUnits(item.unit) ? 1 : 0.001} max={1000000000} step={wholeUnits(item.unit) ? 1 : 0.001} defaultValue={quantity}
            onBlur={event => {
              const field = event.currentTarget
              if (field.value && field.validity.valid && field.valueAsNumber !== quantity) basket.setQuantity(item.id, field.valueAsNumber)
              else field.value = String(quantity)
            }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
          <b>{amount === null ? 'Ціну уточнити' : formatPrice(amount)}</b>
          {selected.get(item.id)?.quantity != null && <Button variant="default" radius="xl" size="compact-xs" onClick={() => basket.setQuantity(item.id, null)}>За рекомендацією</Button>}
          <Button variant="light" color="red" radius="xl" size="compact-xs" leftSection={<IconTrash size={14} />} onClick={() => basket.remove(item.id)}>Прибрати</Button>
        </div>
      </li>)}</ul>
      {remaining.length > 0 && <details className="dash-cart-remaining">
        <summary>Ще до закупівлі · {numberFormat.format(remaining.length)} поз.<IconChevronDown size={15} aria-hidden="true" /></summary>
        <ul>{remaining.map(item => <li key={item.id}>
          <Link className="dash-budget-product" to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
          {item.receiptId && item.priceDay && <DocumentLink className="dash-receipt-pill" id={item.receiptId}><IconFileInvoice size={14} aria-hidden="true" />Накладна від {dateLabel(item.priceDay)}</DocumentLink>}
          {seasonal && <SeasonIndicator season={item.season} />}
          <div className="dash-cart-actions"><span>{numberFormat.format(item.quantity)} {item.unit}</span>
            <b>{item.amount === null ? 'Ціну уточнити' : formatPrice(item.amount)}</b>
            <Button variant="default" size="compact-xs" onClick={() => basket.add([{ ...group, items: [item] }])}>Додати до кошика</Button>
          </div>
        </li>)}</ul>
        {remaining.length > 1 && <Button variant="default" size="compact-xs" onClick={() => basket.add([group])}>Додати решту товарів постачальника</Button>}
      </details>}
      {group.id && <Button size="xs" radius="xl" variant="default" leftSection={<IconDownload size={15} />} onClick={() => download(group, items, through, days, cover, seasonal)}>Завантажити замовлення</Button>}
    </details>)}
    {changed.length > 0 && <section className="dash-cart-order"><h4>Постачальник або одиниця змінилися · виключено із суми</h4>
      {changed.map(row => {
        const now = queued.get(row.id)!
        return <div className="dash-cart-obsolete" key={row.id}>{row.name} <small>Тепер · {now.group.name || 'постачальника слід уточнити'}, {now.item.unit}</small>
          <Button variant="default" radius="xl" size="compact-xs" onClick={() => basket.add([{ ...now.group, items: [now.item] }])}>Оновити в кошику</Button>
          <Button variant="light" color="red" radius="xl" size="compact-xs" onClick={() => basket.remove(row.id)}>Прибрати</Button></div>
      })}
    </section>}
    {gone.length > 0 && <section className="dash-cart-order"><h4>Поза поточною чергою · виключено із суми</h4>
      {gone.map(row => <div className="dash-cart-obsolete" key={row.id}>{row.name} <Button variant="light" color="red" radius="xl" size="compact-xs" onClick={() => basket.remove(row.id)}>Прибрати</Button></div>)}
    </section>}
  </details>
}
