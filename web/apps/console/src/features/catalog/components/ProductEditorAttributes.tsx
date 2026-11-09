import { ActionIcon, Autocomplete, Button, Text, TextInput, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getAttributeNames, type ProductAttribute } from '../api/catalogApi'
import { newAttributeRow, type AttributeRow } from '../lib/attributeRows'

type ProductEditorAttributesProps = {
  attributes: AttributeRow[]
  setAttributes: Dispatch<SetStateAction<AttributeRow[]>>
  categoryId: string
  readOnly: boolean
  error?: string
}

export function ProductEditorAttributes({ attributes, setAttributes, categoryId, readOnly, error }: ProductEditorAttributesProps) {
  const names = useApiQuery(`catalog-attribute-names:${categoryId}`, () => getAttributeNames(categoryId || undefined), { enabled: !readOnly })
  const suggestions = useMemo(() => {
    const used = new Set(attributes.map((attribute) => attribute.name.trim().toLowerCase()))
    return (names.data ?? []).map((entry) => entry.name).filter((name) => !used.has(name.trim().toLowerCase()))
  }, [attributes, names.data])

  function change(key: number, patch: Partial<ProductAttribute>) {
    setAttributes((list) => list.map((attribute) => (attribute.key === key ? { ...attribute, ...patch } : attribute)))
  }

  return (
    <section className="catalog-card" aria-labelledby="attributes-title">
      <h2 id="attributes-title" className="app-section-title catalog-card-title">
        Характеристики
      </h2>
      <Text size="xs" c="dimmed" mb="sm">
        Фільтри категорії працюють за назвами, які задано в налаштуваннях категорії.
      </Text>
      {attributes.length > 0 ? (
        <div className="catalog-attr-list" role="list">
          <div className="catalog-attr-head" aria-hidden="true">
            <span>Назва</span>
            <span>Значення</span>
          </div>
          {attributes.map((attribute, index) => (
            <div key={attribute.key} className="catalog-attr-row" role="listitem">
              <Autocomplete
                aria-label={`Назва характеристики ${index + 1}`}
                value={attribute.name}
                data={suggestions}
                maxLength={100}
                limit={12}
                comboboxProps={{ withinPortal: true }}
                onChange={(value) => change(attribute.key, { name: value })}
              />
              <TextInput aria-label={`Значення характеристики ${index + 1}`} value={attribute.value} maxLength={300} onChange={(event) => change(attribute.key, { value: event.currentTarget.value })} />
              {readOnly ? null : (
                <Tooltip label="Прибрати">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={36}
                    aria-label={`Прибрати «${attribute.name || `характеристику ${index + 1}`}»`}
                    onClick={() => setAttributes((list) => list.filter((item) => item.key !== attribute.key))}
                  >
                    <IconTrash size={16} stroke={1.7} />
                  </ActionIcon>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Text size="sm" c="dimmed">
          Характеристик ще немає.
        </Text>
      )}
      {error ? (
        <Text size="xs" c="red" mt={6} role="alert">
          {error}
        </Text>
      ) : null}
      {readOnly ? null : (
        <Button
          mt="sm"
          size="xs"
          variant="default"
          leftSection={<IconPlus size={14} stroke={1.8} />}
          onClick={() => setAttributes((list) => [...list, newAttributeRow()])}
        >
          Додати характеристику
        </Button>
      )}
    </section>
  )
}
