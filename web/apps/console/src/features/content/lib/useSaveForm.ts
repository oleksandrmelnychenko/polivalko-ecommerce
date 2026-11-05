import { useCallback, useState } from 'react'
import { withCsrf, type CsrfHeaders } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage, type Problem } from '@/shared/api/problem'
import { notifySuccess } from '@/shared/ui/notify'

export const CHECK_FIELDS = 'Перевірте виділені поля.'

type FormState = { busy: boolean; errors: Record<string, string>; error: string | null }

const IDLE: FormState = { busy: false, errors: {}, error: null }

type SaveResult = { error?: unknown; response: Response }

export function useSaveForm() {
  const [state, setState] = useState<FormState>(IDLE)

  async function submit<R extends SaveResult>(send: (headers: CsrfHeaders) => Promise<R>, messages: { done: string; failed: string }): Promise<R | null> {
    setState({ ...IDLE, busy: true })
    try {
      const result = await withCsrf(send)
      if (result.response.ok) {
        setState(IDLE)
        notifySuccess(messages.done)
        return result
      }
      const problem = result.error as Problem | undefined
      const errors = joinErrors(problem?.errors)
      setState({ ...IDLE, errors, error: problem?.errors ? CHECK_FIELDS : problemMessage(problem, messages.failed) })
    } catch {
      setState({ ...IDLE, error: NETWORK_ERROR })
    }
    return null
  }

  const invalid = useCallback((errors: Record<string, string>) => setState({ ...IDLE, errors, error: CHECK_FIELDS }), [])
  const reset = useCallback(() => setState(IDLE), [])
  const clearField = useCallback(
    (field: string) =>
      setState((current) => {
        if (!current.errors[field]) return current
        const errors = { ...current.errors }
        delete errors[field]
        return { ...current, errors }
      }),
    [],
  )

  return { ...state, submit, invalid, reset, clearField }
}

function joinErrors(errors: Record<string, string[]> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([field, messages]) => [field, messages.join(' ')]))
}
