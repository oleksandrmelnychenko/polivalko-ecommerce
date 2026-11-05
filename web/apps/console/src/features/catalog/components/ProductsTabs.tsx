import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import type { ProductCounts } from '../api/catalogApi'
import { NEW_PRODUCT_DAYS, type ProductsTab } from '../lib/productFilters'

type ProductsTabsProps = {
  value: ProductsTab
  counts?: ProductCounts
  onChange: (tab: ProductsTab) => void
}

export function ProductsTabs({ value, counts, onChange }: ProductsTabsProps) {
  const count = (pick: (c: ProductCounts) => number) => (counts ? pick(counts) : null)
  const tabs: ScreenTab<ProductsTab>[] = [
    { value: 'all', label: 'Усі', count: count((c) => c.all) },
    { value: 'fill', label: 'Потребують наповнення', count: count((c) => c.needsFilling), hot: true },
    { value: 'new', label: `Нові за ${NEW_PRODUCT_DAYS} днів`, count: count((c) => c.recent30) },
    { value: 'hidden', label: 'Приховані із залишком', count: count((c) => c.hiddenWithStock) },
    { value: 'out', label: 'Немає в наявності', count: count((c) => c.outOfStock) },
  ]

  return <ScreenTabs<ProductsTab> label="Вибірка товарів" tabs={tabs} value={value} onChange={onChange} />
}
