import { SegmentedControl } from '@mantine/core'
import { lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'

const AccountingReturns = lazy(() => import('@/features/accounting/pages/AccountingReturnsPage').then(m => ({ default: m.AccountingReturnsPage })))
const ShopReturns = lazy(() => import('@/features/returns/pages/ReturnsPage').then(m => ({ default: m.ReturnsPage })))

export default function SalesReturnsPage() {
  const { can } = usePermissions()
  const [params, setParams] = useSearchParams()
  if (!can(PermissionKeys.Accounting.View)) return <ShopReturns />
  const legacyShopLink = ['id', 'q', 'from', 'to', 'page', 'pageSize', 'status'].some(key => params.has(key))
  const source = params.get('source') ?? (legacyShopLink ? 'web' : 'accounting')
  const sourceSwitch = <SegmentedControl className="page-mode-switch" aria-label="Джерело повернень" value={source}
    data={[{ value: 'accounting', label: 'Документи обліку' }, { value: 'web', label: 'Інтернет-магазин' }]}
    onChange={value => setParams({ source: value })} />
  return source === 'web' ? <ShopReturns sourceSwitch={sourceSwitch} /> : <AccountingReturns sourceSwitch={sourceSwitch} />
}
