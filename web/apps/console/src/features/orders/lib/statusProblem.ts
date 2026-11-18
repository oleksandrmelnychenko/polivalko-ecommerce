import { problemMessage, type Problem } from '@/shared/api/problem'

const LATIN = /[A-Za-z]/

export function statusProblemText(error: unknown, fallback: string): string {
  const problem = error as Problem | undefined
  if (problem?.code === 'ordering.invalid_transition') {
    return problem.detail && !LATIN.test(problem.detail) ? problem.detail : 'Із поточного статусу такий перехід недоступний.'
  }
  if (problem?.code === 'ordering.concurrent_update') return 'Замовлення щойно змінилося.'
  return problemMessage(error, fallback)
}
