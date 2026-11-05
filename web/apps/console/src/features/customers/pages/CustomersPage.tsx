import { useSearchParams } from 'react-router-dom'
import { ListPage } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import { AccountsTab } from '../components/AccountsTab'
import { OrderCustomersTab } from '../components/OrderCustomersTab'
import './customers.css'

type CustomersTab = 'orders' | 'accounts'

const TABS: ScreenTab<CustomersTab>[] = [
  { value: 'orders', label: 'За замовленнями' },
  { value: 'accounts', label: 'Кабінети' },
]

export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const tab: CustomersTab = params.get('tab') === 'accounts' ? 'accounts' : 'orders'

  function changeTab(next: CustomersTab) {
    if (next === tab) return
    const pageSize = params.get('pageSize')
    const search = new URLSearchParams()
    if (next === 'accounts') search.set('tab', 'accounts')
    if (pageSize) search.set('pageSize', pageSize)
    setParams(search, { replace: true })
  }

  return (
    <ListPage>
      <PageHeader title="Покупці" />
      <ScreenTabs<CustomersTab> label="Покупці" tabs={TABS} value={tab} onChange={changeTab} />
      {tab === 'accounts' ? <AccountsTab /> : <OrderCustomersTab />}
    </ListPage>
  )
}
