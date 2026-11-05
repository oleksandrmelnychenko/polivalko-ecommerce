import { Alert, Button, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'

export type BulkAction = 'category' | 'brand' | 'addLabel' | 'removeLabel'

export const NO_BRAND = '__none__'

type Option = { value: string; label: string }

type ProductsBulkDialogProps = {
  action: BulkAction | null
  count: number
  categories: Option[]
  brands: Option[]
  labels: Option[]
  busy: boolean
  error: string | null
  onSubmit: (action: BulkAction, value: string) => void
  onClose: () => void
}

const COPY: Record<BulkAction, { title: string; field: string; placeholder: string; submit: string; empty: string }> = {
  category: { title: 'Призначити категорію', field: 'Категорія', placeholder: 'Оберіть категорію', submit: 'Призначити', empty: 'Категорій немає.' },
  brand: { title: 'Призначити бренд', field: 'Бренд', placeholder: 'Оберіть бренд', submit: 'Призначити', empty: 'Довідник брендів порожній.' },
  addLabel: { title: 'Додати мітку', field: 'Мітка', placeholder: 'Оберіть мітку', submit: 'Додати', empty: 'Ручних міток ще немає.' },
  removeLabel: { title: 'Зняти мітку', field: 'Мітка', placeholder: 'Оберіть мітку', submit: 'Зняти', empty: 'Ручних міток ще немає.' },
}

export function ProductsBulkDialog({ action, count, categories, brands, labels, busy, error, onSubmit, onClose }: ProductsBulkDialogProps) {
  const [value, setValue] = useState<string | null>(null)
  const [seenAction, setSeenAction] = useState(action)

  if (seenAction !== action) {
    setSeenAction(action)
    setValue(null)
  }

  const copy = action ? COPY[action] : COPY.category
  const data = action === 'category' ? categories : action === 'brand' ? brands : labels

  function submit(event: FormEvent) {
    event.preventDefault()
    if (action && value) onSubmit(action, value)
  }

  return (
    <AppModal opened={action !== null} title={copy.title} closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy} onClose={onClose}>
      <form noValidate onSubmit={submit} aria-label={copy.title}>
        <Stack gap="sm">
          <Text size="sm" className="catalog-bulk-select-hint">
            {action === 'category'
              ? `Вибрані товари (${count}) перейдуть у вибрану категорію.`
              : action === 'brand'
                ? `Бренд буде замінено у вибраних товарах (${count}).`
                : action === 'addLabel'
                  ? `Мітку буде додано до вибраних товарів (${count}). Автоматичні мітки («Акція», «Новинка») ставляться самі й тут не призначаються.`
                  : `Мітку буде знято з вибраних товарів (${count}), де вона є.`}
          </Text>
          <Select
            label={copy.field}
            placeholder={copy.placeholder}
            data={data}
            value={value}
            searchable
            nothingFoundMessage={data.length ? 'Нічого не знайдено' : copy.empty}
            comboboxProps={{ withinPortal: true }}
            onChange={setValue}
            data-autofocus
          />
          {error ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {error}
            </Alert>
          ) : null}
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" loading={busy} disabled={!value}>
            {copy.submit}
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
