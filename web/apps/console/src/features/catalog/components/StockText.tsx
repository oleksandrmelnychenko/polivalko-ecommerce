import { NumberValue } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'

export const LOW_STOCK = 3

const qtyFmt = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

type StockTextProps = {
  stock: number
  reserved?: number
  available?: number
  warehouseStoreTitle?: string | null
  warehouseLinked?: boolean
}

export function StockText({ stock, reserved = 0, available, warehouseStoreTitle, warehouseLinked }: StockTextProps) {
  const effectiveAvailable = available ?? Math.max(0, stock - reserved)
  const main =
    effectiveAvailable <= 0 ? (
      <TableChip tone="danger" value="Немає" />
    ) : effectiveAvailable <= LOW_STOCK ? (
      <TableChip tone="warning" value={`Мало · ${qtyFmt.format(effectiveAvailable)}`} />
    ) : (
      <NumberValue value={effectiveAvailable} />
    )

  const hasSub = reserved > 0 || Boolean(warehouseStoreTitle) || Boolean(warehouseLinked)
  if (!hasSub) return main

  return (
    <span className="catalog-stock-cell">
      <span>{main}</span>
      {reserved > 0 && (
        <small className="catalog-stock-sub">
          всього {qtyFmt.format(stock)} · резерв {qtyFmt.format(reserved)}
        </small>
      )}
      {(warehouseStoreTitle || warehouseLinked) && (
        <TableChip tone="product" value={warehouseStoreTitle ? `Склад: ${warehouseStoreTitle}` : 'Склад'} />
      )}
    </span>
  )
}
