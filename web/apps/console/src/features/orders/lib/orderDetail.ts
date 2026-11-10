import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { TableChipTone } from '@/shared/ui/TableChip'

export const attemptLabel: Record<string, string> = {
  created: 'Створено',
  processing: 'Обробляється',
  succeeded: 'Успішно',
  failed: 'Відмова',
  expired: 'Прострочено',
  reversed: 'Повернено',
}

export function outcomeTone(status: string): TableChipTone {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

export function receiptStateLabel(status: string, issuedAt: string | null, format: (iso: string) => string): string {
  if (status === 'issued') return `Видано ${issuedAt ? format(issuedAt) : ''}`.trim()
  if (status === 'pending') return 'Видається'
  return 'Помилка'
}

export function receiptTone(status: string): TableChipTone {
  if (status === 'issued') return 'success'
  if (status === 'pending') return 'neutral'
  return 'danger'
}

export function usePrintedAt(): string {
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    const stamp = () => flushSync(() => setPrintedAt(new Date().toISOString()))
    window.addEventListener('beforeprint', stamp)
    return () => window.removeEventListener('beforeprint', stamp)
  }, [])

  return printedAt
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 12 || !digits.startsWith('380')) return phone
  return `+380 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
}
