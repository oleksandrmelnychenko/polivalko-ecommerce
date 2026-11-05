import { useCallback, useState, type RefObject } from 'react'
import { withCsrf, type CsrfHeaders } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage, type Problem } from '@/shared/api/problem'
import { notifySuccess } from '@/shared/ui/notify'

export const CHECK_FIELDS = 'Перевірте виділені поля.'

export type FieldErrors = Record<string, string>

type FormState = { busy: boolean; errors: FieldErrors; error: string | null }

const IDLE: FormState = { busy: false, errors: {}, error: null }

type SaveResult = { error?: unknown; response: Response }

export type SaveStep<R extends SaveResult = SaveResult> = {
  send: (headers: CsrfHeaders) => Promise<R>
  failed: string
}

export function fieldKey(...path: (string | number)[]): string {
  return path.join('.').replace(/\[(\d+)\]/g, '.$1').toLowerCase()
}

export function fieldError(errors: FieldErrors, ...path: (string | number)[]): string | undefined {
  return errors[fieldKey(...path)]
}

export function focusFirstError(form: HTMLFormElement | null | undefined): void {
  requestAnimationFrame(() => {
    const field = form?.querySelector<HTMLElement>('[aria-invalid="true"]')
    field?.scrollIntoView({ block: 'center' })
    field?.focus({ preventScroll: true })
  })
}

export function useSaveForm(formRef?: RefObject<HTMLFormElement | null>) {
  const [state, setState] = useState<FormState>(IDLE)

  async function submitAll(steps: SaveStep[], done: string): Promise<(SaveResult | null)[]> {
    setState({ ...IDLE, busy: true })
    const results: (SaveResult | null)[] = []
    let errors: FieldErrors = {}
    let message: string | null = null
    for (const step of steps) {
      try {
        const result = await withCsrf(step.send)
        if (result.response.ok) {
          results.push(result)
          continue
        }
        const problem = result.error as Problem | undefined
        const stepErrors = normalizeErrors(problem?.errors)
        errors = { ...errors, ...stepErrors }
        message ??= Object.keys(stepErrors).length > 0 ? CHECK_FIELDS : problemMessage(problem, step.failed)
      } catch {
        message ??= NETWORK_ERROR
      }
      results.push(null)
    }
    setState({ busy: false, errors, error: message })
    if (Object.keys(errors).length > 0) focusFirstError(formRef?.current)
    if (!message) notifySuccess(done)
    return results
  }

  async function submit<R extends SaveResult>(send: (headers: CsrfHeaders) => Promise<R>, messages: { done: string; failed: string }): Promise<R | null> {
    const [result] = await submitAll([{ send, failed: messages.failed }], messages.done)
    return (result as R | null) ?? null
  }

  const invalid = useCallback(
    (errors: FieldErrors) => {
      setState({ ...IDLE, errors: normalizeKeys(errors), error: CHECK_FIELDS })
      focusFirstError(formRef?.current)
    },
    [formRef],
  )
  const reset = useCallback(() => setState(IDLE), [])
  const clearField = useCallback(
    (...path: (string | number)[]) =>
      setState((current) => {
        const key = fieldKey(...path)
        if (!current.errors[key]) return current
        const errors = { ...current.errors }
        delete errors[key]
        return { ...current, errors }
      }),
    [],
  )

  return { ...state, submit, submitAll, invalid, reset, clearField }
}

function normalizeErrors(errors: Record<string, string[]> | undefined): FieldErrors {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([field, messages]) => [fieldKey(field), messages.join(' ')]))
}

function normalizeKeys(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).map(([field, message]) => [fieldKey(field), message]))
}
