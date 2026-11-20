import { IconTags } from '@tabler/icons-react'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { MultiSelect, Text } from '@mantine/core'
import { useMemo } from 'react'
import type { Product } from '../api/catalogApi'
import type { ProductLabel } from '../api/dictionariesApi'
import { manualLabelOptions } from '../lib/labels'
import { LabelChip } from './LabelChip'

type ProductEditorLabelsProps = {
  product: Product
  labels: ProductLabel[] | null
  value: string[]
  onChange: (ids: string[]) => void
  error?: string
}

export function ProductEditorLabels({ product, labels, value, onChange, error }: ProductEditorLabelsProps) {
  const options = useMemo(() => {
    const manual = manualLabelOptions(labels ?? [])
    const missing = value.filter((id) => !manual.some((option) => option.value === id))
    return [...manual, ...missing.map((id) => ({ value: id, label: product.labels.find((label) => label.id === id)?.name ?? 'Видалена мітка' }))]
  }, [labels, product.labels, value])
  const auto = product.labels.filter(label => label.kind !== 'manual')

  return (
    <section className="catalog-card" aria-labelledby="labels-title">
      <CatalogSectionTitle id="labels-title" icon={IconTags}>Мітки</CatalogSectionTitle>
      {labels === null ? (
        <Text size="sm" c="dimmed">
          Довідник міток зараз недоступний, тому мітки товару змінити не можна.
        </Text>
      ) : (
        <>
          <MultiSelect
            label="Мітки на плитці товару"
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
              {auto.map(label => (
                <li key={label.id}><LabelChip name={label.name} tone={label.tone} /></li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  )
}
