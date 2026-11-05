import { api } from '@/shared/api/client'

export function getSummary() {
  return api.GET('/api/v1/console/summary')
}
