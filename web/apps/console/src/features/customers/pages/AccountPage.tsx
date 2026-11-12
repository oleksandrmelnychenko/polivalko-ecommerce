import { Navigate, useParams } from 'react-router-dom'
import { accountHref } from '../lib/accountsState'

export function AccountPage() {
  const { id = '' } = useParams()
  return <Navigate replace to={accountHref(id)} />
}
