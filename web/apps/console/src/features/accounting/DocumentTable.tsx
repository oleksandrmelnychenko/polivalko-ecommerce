import { Table } from '@mantine/core'
import { IconArrowBackUp, IconFileInvoice, IconListCheck, IconPackageExport, IconPackageImport, IconReceipt, IconTransferIn, IconTrashX } from '@tabler/icons-react'
import { DocumentLink, PartnerDetailLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import { Grid } from './RegisterTable'
import { kindName, money, paymentNames, statusNames, type Doc } from './api'

export function PartnerLink({ doc, chip = false }: { doc: Doc; chip?: boolean }) {
  const label = doc.partnerTitle || (doc.partnerId ? 'Контрагент' : '—')
  const content = chip && label !== '—' ? <TableChip tone="document" value={label} /> : label
  return doc.partnerId
    ? <PartnerDetailLink id={doc.partnerId}>{content}</PartnerDetailLink>
    : <>{content}</>
}

export function DocumentStatus({ doc }: { doc: Doc }) {
  return <span className="doc-status" data-status={doc.status}>{statusNames[doc.status ?? ''] ?? doc.status ?? '—'}</span>
}

export function documentIcon(doc: Doc) {
  if (doc.entityType === 'customerReturn') return IconArrowBackUp
  if (doc.entityType === 'receipt') return IconReceipt
  if (doc.entityType === 'invoice' && doc.kind === 'out') return IconPackageExport
  if (doc.entityType === 'invoice' && doc.kind === 'in') return IconPackageImport
  if (doc.entityType === 'stockOperation') return doc.kind === 'income' ? IconTransferIn : doc.kind === 'writeOff' ? IconTrashX : IconListCheck
  return IconFileInvoice
}

export function DocTable({ rows, direction, balanceLabel, separateNumber = direction === 'out' }: {
  rows: Doc[]; balanceLabel?: string; direction?: 'in' | 'out' | null; separateNumber?: boolean
}) {
  const outgoing = direction === 'out'
  const partnerLabel = direction === 'in' ? 'Постачальник' : outgoing ? 'Покупець' : 'Контрагент'
  const dueLabel = balanceLabel ?? (outgoing ? 'До отримання' : 'До сплати')
  const showIcons = separateNumber || Boolean(balanceLabel)
  return (
    <div className="doc-list" data-separate-number={separateNumber || undefined}>
      <Grid columns={[...(separateNumber ? ['Номер'] : []), 'Документ', partnerLabel, 'Дата', 'Стан документа', 'Сума', 'Оплата', ...(direction || balanceLabel ? [dueLabel] : [])]}>
        {rows.map((d) => {
          const RowIcon = documentIcon(d)
          return <Table.Tr key={d.id}>
            {separateNumber && <Table.Td className="doc-invoice-number doc-icon-cell">
              <RowIcon className="doc-row-icon" size={32} aria-hidden="true" />
              <DocumentLink id={d.id} aria-label={`${kindName(d) || 'Документ'} № ${d.number || d.sourceId}`}>№ {d.number || d.sourceId}</DocumentLink>
            </Table.Td>}
            <Table.Td className={showIcons && !separateNumber ? 'doc-name doc-icon-cell' : 'doc-name'}>
              {showIcons && !separateNumber && <RowIcon className="doc-row-icon" size={32} aria-hidden="true" />}
              <DocumentLink id={d.id}>
                {kindName(d) || 'Документ'}{!separateNumber && <> № <span>{d.number || d.sourceId}</span></>}
              </DocumentLink>
              {d.organization && <small>{d.organization}</small>}
            </Table.Td>
            <Table.Td data-label={partnerLabel}><PartnerLink doc={d} /></Table.Td>
            <Table.Td data-label="Дата" className="ledger-number">{d.day ?? '—'}</Table.Td>
            <Table.Td data-label="Стан документа"><DocumentStatus doc={d} /></Table.Td>
            <Table.Td data-label="Сума" className="register-money">{money(d.amount, d.currency)}</Table.Td>
            <Table.Td data-label="Оплата"><span data-payment={showIcons ? d.paymentStatus : undefined}>{paymentNames[d.paymentStatus ?? ''] ?? d.paymentStatus ?? '—'}</span></Table.Td>
            {(direction || balanceLabel) && <Table.Td data-label={dueLabel} className="register-money">{money(d.due ?? null, d.currency)}</Table.Td>}
          </Table.Tr>
        })}
      </Grid>
    </div>
  )
}
