import { NumberValue } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'

const LOW_STOCK = 3

export function StockText({ stock }: { stock: number }) {
  if (stock <= 0) return <TableChip tone="danger" value="Немає" />
  if (stock <= LOW_STOCK) return <TableChip tone="warning" value={`Мало · ${stock}`} />
  return <NumberValue value={stock} />
}
