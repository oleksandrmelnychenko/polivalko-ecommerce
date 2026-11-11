import { Tooltip } from '@mantine/core'
import { IconLayoutGrid, IconTable } from '@tabler/icons-react'
import type { ProductsView } from '../lib/useProductsView'

const VIEWS = [
  { value: 'table', label: 'Таблицею', Icon: IconTable },
  { value: 'tiles', label: 'Плитками', Icon: IconLayoutGrid },
] as const

type ProductsViewToggleProps = {
  value: ProductsView
  onChange: (view: ProductsView) => void
}

export function ProductsViewToggle({ value, onChange }: ProductsViewToggleProps) {
  return (
    <div className="catalog-view-toggle" role="group" aria-label="Вигляд списку">
      {VIEWS.map(({ value: view, label, Icon }) => (
        <Tooltip key={view} label={label}>
          <button type="button" className="catalog-view-toggle-button" aria-label={label} aria-pressed={value === view} onClick={() => onChange(view)}>
            <Icon size={16} stroke={1.8} aria-hidden="true" />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
