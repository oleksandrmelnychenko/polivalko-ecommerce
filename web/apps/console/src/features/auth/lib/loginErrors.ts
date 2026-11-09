import type { Problem } from '@/shared/api/problem'

export function loginErrorMessage(status: number, problem: Problem | undefined): string {
  if (problem?.code === 'auth.locked_out') {
    return 'Забагато невдалих спроб. Обліковий запис тимчасово заблоковано, спробуйте за 15 хвилин.'
  }
  if (problem?.code === 'auth.two_factor_required') return 'Введіть код із застосунку-автентифікатора.'
  if (problem?.code === 'auth.invalid_two_factor_code') return 'Код не підходить. Введіть новий код із застосунку або невикористаний резервний код.'
  if (status === 429) return 'Забагато спроб. Зачекайте хвилину.'
  if (status === 401 || status === 400) return 'Неправильний email або пароль.'
  return 'Не вдалося увійти. Спробуйте ще раз.'
}
