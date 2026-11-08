import { useApiQuery } from '@/shared/api/useApiQuery'
import { getTwoFactorStatus } from './api/authApi'

export function useTwoFactorStatus(enabled = true) {
  return useApiQuery('two-factor-status', () => getTwoFactorStatus(), { enabled })
}
