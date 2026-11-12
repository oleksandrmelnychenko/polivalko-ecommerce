import { useSearchParams } from 'react-router-dom'
import type { AccountListItem } from '@/shared/sales/salesLookups'
import { ListPage } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import { AccountsTab } from '../components/AccountsTab'
import { OrderCustomersTab } from '../components/OrderCustomersTab'
import '@/shared/ui/split/split.css'
import './customers.css'

type CustomersTab = 'orders' | 'accounts'

const TABS: ScreenTab<CustomersTab>[] = [
  { value: 'orders', label: 'За замовленнями' },
  { value: 'accounts', label: 'Кабінети' },
]

export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const tab: CustomersTab = params.get('tab') === 'accounts' ? 'accounts' : 'orders'

  function changeTab(next: CustomersTab, id?: string) {
    if (next === tab && !id) return
    const pageSize = params.get('pageSize')
    const search = new URLSearchParams()
    if (next === 'accounts') search.set('tab', 'accounts')
    if (pageSize) search.set('pageSize', pageSize)
    if (id) search.set('id', id)
    setParams(search, { replace: !id })
  }

  return (
    <ListPage>
      <PageHeader title="Покупці" />
      <ScreenTabs<CustomersTab> label="Покупці" tabs={TABS} value={tab} onChange={(next) => changeTab(next)} />
      {tab === 'accounts' ? <AccountsTab /> : <OrderCustomersTab onOpenAccount={(account: AccountListItem) => changeTab('accounts', account.id)} />}
    </ListPage>
  )
}
