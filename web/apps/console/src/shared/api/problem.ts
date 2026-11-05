import { problemText, type Problem } from '@polivalko/shared/api/problem'

export { fieldErrors, problemOf, problemText, problemTitle, type Problem } from '@polivalko/shared/api/problem'

export const NETWORK_ERROR = "Немає зв'язку з сервером. Спробуйте ще раз."
export const FORBIDDEN_ERROR = 'Недостатньо прав для цієї дії.'

export function problemCode(error: unknown): string | undefined {
  return (error as Problem | undefined)?.code
}

export function problemMessage(error: unknown, fallback: string): string {
  const problem = error as Problem | undefined
  if (problem?.code === 'auth.forbidden') return problem.detail ?? FORBIDDEN_ERROR
  return problemText(problem, fallback)
}
