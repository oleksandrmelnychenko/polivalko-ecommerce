import { ActionIcon, Group, Tooltip } from '@mantine/core'
import { IconArrowUpRight, IconCash, IconPackages, IconPencil } from '@tabler/icons-react'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TableChip } from '@/shared/ui/TableChip'
import type { Product } from '../api/catalogApi'
import { ProductPriceDialog } from './ProductPriceDialog'
import { ProductStockDialog } from './ProductStockDialog'

const qtyFmt = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

type ProductEditorNavkoloProps = {
  product: Product
  canUpdatePrice: boolean
  priceLoading: boolean
  onReload: () => void
  onPriceSaved: (product: Product) => void
}

export function ProductEditorNavkolo({ product, canUpdatePrice, priceLoading, onReload, onPriceSaved }: ProductEditorNavkoloProps) {
  const n = product.navkolo
  const [editingPrice, setEditingPrice] = useState(false)
  const [editingStock, setEditingStock] = useState(false)
  const total = n.stock
  const reserved = product.reservedQuantity ?? 0
  const available = product.availableQuantity ?? Math.max(0, total - reserved)
  const linkedWarehouse = product.warehouseStoreId != null
  const warehouseTitle = product.warehouseStoreTitle || 'Прив’язаний склад'

  return (
    <div className="product-editor-metrics">
      <section className="catalog-card product-metric" aria-labelledby="retail-title">
        <CatalogSectionTitle id="retail-title" icon={IconCash}>Ціна</CatalogSectionTitle>
        {canUpdatePrice && <Tooltip label="Змінити роздрібну ціну"><ActionIcon variant="light" color="gray" aria-label="Змінити роздрібну ціну" disabled={priceLoading} onClick={() => setEditingPrice(true)}><IconPencil size={16} /></ActionIcon></Tooltip>}
        <div className="product-metric-value">{formatMoney(n.price)} {n.oldPrice && <s aria-label="Попередня ціна">{formatMoney(n.oldPrice)}</s>}</div>
        <small>Оновлено {formatDateTime(n.priceUpdatedAt)}</small>
      </section>
      <section className="catalog-card product-metric" aria-labelledby="stock-title">
        <CatalogSectionTitle id="stock-title" icon={IconPackages}>Залишок</CatalogSectionTitle>
        {canUpdatePrice && (
          <Tooltip
            label={
              linkedWarehouse
                ? `Залишок синхронізується зі складом «${warehouseTitle}». Керуйте ним у розділі «Склад → Залишки».`
                : 'Змінити залишок'
            }
          >
            <ActionIcon
              variant="light"
              color="gray"
              aria-label="Змінити залишок"
              disabled={priceLoading || linkedWarehouse}
              onClick={() => { if (!linkedWarehouse) setEditingStock(true) }}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        <div className="product-metric-value">
          Доступно {qtyFmt.format(available)}
        </div>
        <small>
          Доступно {qtyFmt.format(available)} (всього {qtyFmt.format(total)}, у резерві {qtyFmt.format(reserved)})
        </small>
        {linkedWarehouse && (
          <Group gap={8} mt={4} wrap="wrap">
            <TableChip tone="product" value={`Склад: ${warehouseTitle}`} />
            <Link to={`/warehouse/stock?q=${encodeURIComponent(n.sku)}`} className="catalog-warehouse-link">
              Складські залишки <IconArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </Group>
        )}
        <small>Оновлено {formatDateTime(n.stockUpdatedAt)}</small>
      </section>
      {editingStock && !linkedWarehouse && <ProductStockDialog product={product} onClose={() => setEditingStock(false)} onReload={onReload} />}
      {canUpdatePrice && editingPrice ? (
        <ProductPriceDialog
          product={product}
          onClose={() => setEditingPrice(false)}
          onReload={onReload}
          onSaved={updated => { onPriceSaved(updated); setEditingPrice(false) }}
        />
      ) : null}
    </div>
  )
}
