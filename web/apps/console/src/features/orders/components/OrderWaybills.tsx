import { Button, CopyButton } from '@mantine/core'
import { useRef } from 'react'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getOrderWaybills } from '../api/orderDetailApi'

export function OrderWaybills({ number }: { number: string }) {
  const refresh = useRef(false)
  const query = useApiQuery(`order-waybills:${number}`, () => getOrderWaybills(number, refresh.current))
  const result = query.data
  if (result?.status === 'not_applicable') return null
  const bills = result?.status === 'complete' ? result.waybills : undefined
  let message = ''
  if (query.isFetching) message = 'Звіряємо з кабінетом відправника…'
  else if (result?.status === 'rate_limited') message = 'Нова пошта обмежила частоту запитів. Спробуйте пізніше.'
  else if (result?.status === 'not_configured') message = 'Для перевірки потрібен ключ кабінету відправника.'
  else if (query.status === 'error' || !bills) message = 'Не вдалося перевірити реєстр Нової пошти.'
  else if (!bills.length) message = `ТТН ще не знайдено. У кабінеті Нової пошти вкажіть ${number} як номер замовлення клієнта.`

  return <div>
    <dt>ТТН Нової пошти</dt>
    <dd>
      {message && <span role="status">{message}</span>}
      {bills?.map(bill => <div key={bill.number}>
        <strong>{bill.number}</strong>{' · '}<time dateTime={bill.date}>{bill.date.split('-').reverse().join('.')}</time>{' '}
        <CopyButton value={bill.number}>{({ copied, copy }) =>
          <Button variant="subtle" size="compact-xs" onClick={copy} aria-label={`Скопіювати ТТН ${bill.number}`}>
            {copied ? 'Скопійовано' : 'Скопіювати'}
          </Button>}</CopyButton>
      </div>)}
      <Button variant="subtle" size="compact-xs" disabled={query.isFetching} onClick={() => {
        refresh.current = true
        query.reload()
      }}>Перевірити ТТН</Button>
    </dd>
  </div>
}
