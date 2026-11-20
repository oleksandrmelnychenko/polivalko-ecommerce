import { IconCalendarPlus, IconChecklist, IconEyeOff, IconPackage, IconPackageOff } from '@tabler/icons-react'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import type { ProductCounts } from '../api/catalogApi'
import { NEW_PRODUCT_DAYS, type ProductsTab } from '../lib/productFilters'

type ProductsTabsProps = {
  value: ProductsTab
  counts?: ProductCounts
  onChange: (tab: ProductsTab) => void
}

export function ProductsTabs({ value, counts, onChange }: ProductsTabsProps) {
  const tabs: ScreenTab<ProductsTab>[] = selections.map(({ value, label, icon, key }) => ({
    value,
    label: <MetricLabel icon={icon}>{label}</MetricLabel>,
    count: counts?.[key] ?? null,
    footer: <MetricTrack value={counts?.[key] ?? 0} max={counts?.all ?? 0} />,
  }))
  return <ScreenTabs<ProductsTab> label="Вибірка товарів" tabs={tabs} value={value} onChange={onChange} />
}

const selections = [
  { value: 'all', label: 'Усі', icon: IconPackage, key: 'all' },
  { value: 'fill', label: 'Потребують наповнення', icon: IconChecklist, key: 'needsFilling' },
  { value: 'new', label: `Нові за ${NEW_PRODUCT_DAYS} днів`, icon: IconCalendarPlus, key: 'recent30' },
  { value: 'hidden', label: 'Приховані із залишком', icon: IconEyeOff, key: 'hiddenWithStock' },
  { value: 'out', label: 'Немає в наявності', icon: IconPackageOff, key: 'outOfStock' },
] as const
