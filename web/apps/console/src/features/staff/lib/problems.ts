import { FORBIDDEN_ERROR, NETWORK_ERROR, fieldErrors, type Problem } from '@/shared/api/problem'
import { notifyError } from '@/shared/ui/notify'

export type Failure = { title: string; detail?: string; code?: string; fields: Record<string, string>; problem?: Problem }

export function toFailure(error: unknown, fallback: string): Failure {
  const problem = error as Problem | undefined
  const fields = fieldErrors(error)
  if (!problem?.title) return { title: fallback, fields }
  if (problem.code === 'auth.forbidden') return { title: 'Недостатньо прав', detail: problem.detail ?? FORBIDDEN_ERROR, code: problem.code, fields, problem }
  return { title: problem.title, detail: problem.detail, code: problem.code, fields, problem }
}

export const NETWORK_FAILURE: Failure = { title: NETWORK_ERROR, fields: {} }

export function notifyFailure(error: unknown, fallback: string): void {
  const failure = toFailure(error, fallback)
  if (failure.detail) notifyError(failure.detail, failure.title)
  else notifyError(failure.title)
}

export function extraFieldMessages(failure: Failure | null, shown: readonly string[]): string[] {
  if (!failure) return []
  return Object.entries(failure.fields)
    .filter(([field]) => !shown.includes(field))
    .map(([, message]) => message)
}

export const PASSWORD_HELP = 'Щонайменше 10 символів.'
