import type { Money as MoneyValue } from '@polivalko/shared/api/types'
import { formatMoney, formatPrice } from '@polivalko/shared/lib/format'
import type { ReactNode } from 'react'

export function Money({ value, sub }: { value: MoneyValue | string | number | null | undefined; sub?: ReactNode }) {
  if (value == null) return <span>немає</span>
  const text = typeof value === 'object' ? formatMoney(value) : formatPrice(value)
  if (sub == null) return <span className="app-money">{text}</span>
  return (
    <span className="app-cell-stack" style={{ alignItems: 'flex-end' }}>
      <span className="app-money">{text}</span>
      <span className="app-cell-sub">{sub}</span>
    </span>
  )
}

const numberFormat = new Intl.NumberFormat('uk-UA')

export function NumberValue({ value }: { value: number | null | undefined }) {
  return <span className="app-number">{value == null ? 'немає' : numberFormat.format(value)}</span>
}

export function CellStack({ title, sub, code = false }: { title: ReactNode; sub?: ReactNode; code?: boolean }) {
  return (
    <span className="app-cell-stack">
      <span className={code ? 'app-cell-title app-cell-code' : 'app-cell-title'}>{title}</span>
      {sub != null && sub !== '' ? <span className="app-cell-sub">{sub}</span> : null}
    </span>
  )
}
