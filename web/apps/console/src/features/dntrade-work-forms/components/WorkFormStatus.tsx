import { TableChip } from '@/shared/ui/TableChip'
import { workFormStatusLabel } from '../lib/workForms'

export function WorkFormStatus({ status }: { status: string }) {
  return <TableChip dot value={workFormStatusLabel(status)} tone={status === 'ready' ? 'success' : status === 'draft' ? 'warning' : 'neutral'} />
}
