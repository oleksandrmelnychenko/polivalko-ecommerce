import { MultiSelect, Text } from '@mantine/core'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import type { Product } from '../api/catalogApi'
import type { ProductLabel } from '../api/dictionariesApi'
import { labelRule, manualLabelOptions, sortLabels } from '../lib/labels'
import { LabelChip } from './LabelChip'

type ProductEditorLabelsProps = {
  product: Product
  labels: ProductLabel[] | null
  value: string[]
  onChange: (ids: string[]) => void
  error?: string
}

function applies(label: ProductLabel, product: Product): boolean {
  return label.isActive && product.labels.some((applied) => applied.id === label.id)
}

export function ProductEditorLabels({ product, labels, value, onChange, error }: ProductEditorLabelsProps) {
  const { can } = usePermissions()
  const options = useMemo(() => {
    const manual = manualLabelOptions(labels ?? [])
    const missing = value.filter((id) => !manual.some((option) => option.value === id))
    return [...manual, ...missing.map((id) => ({ value: id, label: product.labels.find((label) => label.id === id)?.name ?? 'Видалена мітка' }))]
  }, [labels, product.labels, value])
  const auto = useMemo(() => sortLabels((labels ?? []).filter((label) => label.kind !== 'manual')), [labels])

  return (
    <section className="catalog-card" aria-labelledby="labels-title">
      <h2 id="labels-title" className="app-section-title catalog-card-title">
        Мітки
      </h2>
      {labels === null ? (
        <Text size="sm" c="dimmed">
          Довідник міток зараз недоступний, мітки товару не змінюються.
        </Text>
      ) : (
        <>
          <MultiSelect
            label="Мітки на плитці товару"
            description={
              <>
                Лише ручні мітки. Колір і порядок задаються в{' '}
                {can(PermissionKeys.Catalog.ManageLabels) ? (
                  <Link to="/catalog/labels" className="catalog-link">
                    довіднику міток
                  </Link>
                ) : (
                  'довіднику міток'
                )}
                .
              </>
            }
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            placeholder={value.length ? undefined : 'Без міток'}
            data={options}
            value={value}
            searchable
            clearable
            nothingFoundMessage={options.length ? 'Нічого не знайдено' : 'Ручних міток ще немає'}
            comboboxProps={{ withinPortal: true }}
            error={error}
            onChange={onChange}
          />
          {auto.length > 0 ? (
            <ul className="catalog-auto-labels" aria-label="Автоматичні мітки">
              {auto.map((label) => {
                const on = applies(label, product)
                return (
                  <li key={label.id} className="catalog-auto-label">
                    <LabelChip name={label.name} tone={label.tone} muted={!on} />
                    <span className="catalog-auto-label-rule">
                      {label.isActive ? labelRule(label) : 'Мітку вимкнено в довіднику'}
                      {label.isActive ? <span className="catalog-muted"> · {on ? 'стоїть зараз' : 'зараз не стоїть'}</span> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )}
    </section>
  )
}
