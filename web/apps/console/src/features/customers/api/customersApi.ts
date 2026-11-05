import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

export type CustomersQuery = NonNullable<paths['/api/v1/console/customers']['get']['parameters']['query']>
export type Customer = components['schemas']['ConsoleCustomerDto']

export function getCustomers(query: CustomersQuery) {
  return api.GET('/api/v1/console/customers', { params: { query } })
}
