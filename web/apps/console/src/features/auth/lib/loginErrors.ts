import type { Problem } from '@/shared/api/problem'

export function loginErrorMessage(status: number, problem: Problem | undefined): string {
  if (problem?.code === 'auth.locked_out') {
    return 'Забагато невдалих спроб. Обліковий запис тимчасово заблоковано, спробуйте за 15 хвилин.'
  }
  if (status === 429) return 'Забагато спроб. Зачекайте хвилину.'
  if (status === 401 || status === 400) return 'Невірний email або пароль.'
  return 'Не вдалося увійти. Спробуйте ще раз.'
}
