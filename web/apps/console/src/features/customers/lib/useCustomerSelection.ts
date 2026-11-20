import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useCustomerSelection() {
  const [params, setParams] = useSearchParams()
  const setId = useCallback((id: string | null) => {
    const next = new URLSearchParams(window.location.search)
    if (id) next.set('id', id)
    else next.delete('id')
    setParams(next, { replace: true })
  }, [setParams])
  return { id: params.get('id'), setId }
}
