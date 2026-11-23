import { IconChevronDown, IconChevronRight, IconFileInvoice } from '@tabler/icons-react'
import { dateLabel } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'

type Invoice = { id: string; number?: string | null; day: string }

export function PurchaseInvoice({ id, day, number }: { id: string | null; day: string | null; number?: string | null }) {
  return id && day ? <PurchaseInvoices invoices={[{ id, day, number }]} /> : null
}

export function PurchaseInvoices({ invoices }: { invoices: Invoice[] }) {
  return <details className="dash-cost-sources">
    <summary><IconFileInvoice size={15} aria-hidden="true" />Прибуткові накладні
      <span className="dash-invoice-count">{invoices.length}</span><IconChevronDown size={13} aria-hidden="true" /></summary>
    <div className="dash-invoice-list">
      {invoices.map(invoice => <DocumentLink key={invoice.id} id={invoice.id}>
        <span>{invoice.number === undefined ? 'Накладна' : invoice.number ? '№ ' + invoice.number : 'Без номера'}</span>
        <time dateTime={invoice.day}>{dateLabel(invoice.day)}</time>
        <IconChevronRight size={14} aria-hidden="true" />
      </DocumentLink>)}
    </div>
  </details>
}
