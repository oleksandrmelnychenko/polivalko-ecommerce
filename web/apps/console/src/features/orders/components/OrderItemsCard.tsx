import { Table } from '@mantine/core'
import { formatMoney } from '@polivalko/shared/lib/format'
import { thumb } from '@polivalko/shared/lib/images'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { OrderCard } from './OrderCard'

export function OrderItemsCard({ order }: { order: ConsoleOrder }) {
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const refunded = Number(order.refundedAmount.value) > 0

  return (
    <OrderCard
      className="order-area-items"
      title="Склад"
      aside={
        <span className="order-card-meta">
          {pieces} шт. · {order.items.length} поз.
        </span>
      }
    >
      <Table className="order-table order-items-table" verticalSpacing={8} horizontalSpacing={14}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Товар</Table.Th>
            <Table.Th scope="col" className="is-num order-items-price">
              Ціна
            </Table.Th>
            <Table.Th scope="col" className="is-num">
              Кількість
            </Table.Th>
            <Table.Th scope="col" className="is-num">
              Сума
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {order.items.map((item) => (
            <Table.Tr key={item.productId}>
              <Table.Td className="order-items-product">
                <span className="order-product">
                  {item.imageUrl ? (
                    <img className="order-thumb" src={thumb(item.imageUrl, 120)} alt="" loading="lazy" />
                  ) : (
                    <span className="order-thumb" aria-hidden="true" />
                  )}
                  <span className="order-product-text">
                    <a className="order-product-name" href={siteUrl(`/product/${item.slug}`)} target="_blank" rel="noopener noreferrer">
                      {item.name}
                    </a>
                    <span className="order-product-sku">{item.sku}</span>
                  </span>
                </span>
              </Table.Td>
              <Table.Td className="is-num order-items-price"><span className="money">{formatMoney(item.unitPrice)}</span></Table.Td>
              <Table.Td className="is-num order-items-qty">
                <span className="order-items-unit"><span className="money">{formatMoney(item.unitPrice)}</span> </span>× {item.quantity}
              </Table.Td>
              <Table.Td className="is-num is-strong order-items-sum"><span className="money">{formatMoney(item.lineTotal)}</span></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr className="order-table-total">
            <Table.Th scope="row" colSpan={3}>
              Разом до сплати
            </Table.Th>
            <Table.Td className="is-num"><span className="money">{formatMoney(order.total)}</span></Table.Td>
          </Table.Tr>
          {refunded ? (
            <Table.Tr>
              <Table.Th scope="row" colSpan={3}>
                Повернено
              </Table.Th>
              <Table.Td className="is-num"><span className="money">−{formatMoney(order.refundedAmount)}</span></Table.Td>
            </Table.Tr>
          ) : null}
        </Table.Tfoot>
      </Table>
    </OrderCard>
  )
}
