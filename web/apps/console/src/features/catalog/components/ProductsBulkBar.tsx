import { Button } from '@mantine/core'
import { IconCategory, IconEye, IconEyeOff, IconTag, IconTagOff, IconTrademark, IconX } from '@tabler/icons-react'
import { ListPageFooter } from '@/shared/ui/ListPage'
import type { BulkAction } from './ProductsBulkDialog'
import './catalog.css'

type ProductsBulkBarProps = {
  count: number
  pending: boolean | null
  canBrand: boolean
  canLabels: boolean
  onVisible: (visible: boolean) => void
  onAction: (action: BulkAction) => void
  onClear: () => void
}

export function ProductsBulkBar({ count, pending, canBrand, canLabels, onVisible, onAction, onClear }: ProductsBulkBarProps) {
  const busy = pending !== null
  return (
    <ListPageFooter>
      <div className="catalog-bulk-bar" role="region" aria-label="Дії з вибраними товарами">
        <span className="catalog-bulk-count">
          <b>{count}</b> вибрано
        </span>
        <Button size="sm" leftSection={<IconEye size={16} stroke={1.8} />} disabled={busy && pending !== true} loading={pending === true} onClick={() => onVisible(true)}>
          Показати на сайті
        </Button>
        <Button
          size="sm"
          variant="default"
          leftSection={<IconEyeOff size={16} stroke={1.8} />}
          disabled={busy && pending !== false}
          loading={pending === false}
          onClick={() => onVisible(false)}
        >
          Приховати
        </Button>
        <Button size="sm" variant="default" leftSection={<IconCategory size={16} stroke={1.8} />} disabled={busy} onClick={() => onAction('category')}>
          Призначити категорію
        </Button>
        {canBrand ? (
          <Button size="sm" variant="default" leftSection={<IconTrademark size={16} stroke={1.8} />} disabled={busy} onClick={() => onAction('brand')}>
            Призначити бренд
          </Button>
        ) : null}
        {canLabels ? (
          <>
            <Button size="sm" variant="default" leftSection={<IconTag size={16} stroke={1.8} />} disabled={busy} onClick={() => onAction('addLabel')}>
              Додати мітку
            </Button>
            <Button size="sm" variant="default" leftSection={<IconTagOff size={16} stroke={1.8} />} disabled={busy} onClick={() => onAction('removeLabel')}>
              Зняти мітку
            </Button>
          </>
        ) : null}
        <Button size="sm" variant="subtle" color="gray" leftSection={<IconX size={15} />} disabled={busy} onClick={onClear}>
          Зняти вибір
        </Button>
      </div>
    </ListPageFooter>
  )
}
