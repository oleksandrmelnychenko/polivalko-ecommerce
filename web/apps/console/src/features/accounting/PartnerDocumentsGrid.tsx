import { DocumentLink } from '@/shared/ui/DocumentLink'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { kindName, money, paymentNames, statusNames, type Doc } from './api'

const columns: DataTableColumn<Doc>[] = [
  {
    id: 'document',
    header: 'Документ',
    fill: true,
    width: 186,
    cell: (doc) => (
      <div className="partner-doc-name">
        <DocumentLink id={doc.id}>{kindName(doc)} № {doc.number || doc.sourceId}</DocumentLink>
        {doc.organization && <small>{doc.organization}</small>}
      </div>
    ),
  },
  { id: 'date', header: 'Дата', width: 100, cell: (doc) => doc.day ?? '—' },
  { id: 'amount', header: 'Сума', width: 120, align: 'right', numeric: true, cell: (doc) => money(doc.amount, doc.currency) },
  { id: 'status', header: 'Стан документа', width: 120, cell: (doc) => statusNames[doc.status ?? ''] ?? doc.status ?? '—' },
  { id: 'payment', header: 'Оплата', width: 152, cell: (doc) => paymentNames[doc.paymentStatus ?? ''] ?? doc.paymentStatus ?? '—' },
]

const getRowId = (doc: Doc) => doc.id

export function PartnerDocumentsGrid({ rows, loading }: { rows: Doc[]; loading: boolean }) {
  return (
    <DataTable
      ariaLabel="Документи контрагента"
      columns={columns}
      data={rows}
      getRowId={getRowId}
      minWidth={0}
      maxHeight="min(60dvh, 540px)"
      density="compact"
      isLoading={loading}
      emptyText="Документів за цими умовами немає."
    />
  )
}
