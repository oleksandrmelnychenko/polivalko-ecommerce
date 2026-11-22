import { Table } from '@mantine/core'
import { IconPackageExport, IconPackageImport } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { Grid } from './RegisterTable'
import { kindName, money, paymentNames, statusNames, type Doc } from './api'

export function PartnerLink({ doc }: { doc: Doc }) {
  return doc.partnerId
    ? <Link to={'/accounting/partners/' + doc.partnerId}>{doc.partnerTitle || 'Контрагент'}</Link>
    : <>{doc.partnerTitle || '—'}</>
}

export function DocumentStatus({ doc }: { doc: Doc }) {
  return <span className="doc-status" data-status={doc.status}>{statusNames[doc.status ?? ''] ?? doc.status ?? '—'}</span>
}

export function DocTable({ rows, direction, balanceLabel }: { rows: Doc[]; balanceLabel?: string; direction?: 'in' | 'out' | null }) {
  const outgoing = direction === 'out'
  const partnerLabel = direction === 'in' ? 'Постачальник' : outgoing ? 'Покупець' : 'Контрагент'
  const dueLabel = balanceLabel ?? (outgoing ? 'До отримання' : 'До сплати')
  const showIcons = outgoing || Boolean(balanceLabel)
  return (
    <div className="doc-list" data-separate-number={outgoing || undefined}>
      <Grid columns={[...(outgoing ? ['Номер'] : []), 'Документ', partnerLabel, 'Дата', 'Стан документа', 'Сума', 'Оплата', ...(direction || balanceLabel ? [dueLabel] : [])]}>
        {rows.map((d) => (
          <Table.Tr key={d.id}>
            {outgoing && <Table.Td className="doc-invoice-number doc-icon-cell">
              <IconPackageExport className="doc-row-icon" size={32} aria-hidden="true" />
              <DocumentLink id={d.id} aria-label={`${kindName(d) || 'Документ'} № ${d.number || d.sourceId}`}>№ {d.number || d.sourceId}</DocumentLink>
            </Table.Td>}
            <Table.Td className={showIcons && !outgoing ? 'doc-name doc-icon-cell' : 'doc-name'}>
              {showIcons && !outgoing && (d.kind === 'in' ? <IconPackageImport className="doc-row-icon" size={32} aria-hidden="true" /> : <IconPackageExport className="doc-row-icon" size={32} aria-hidden="true" />)}
              <DocumentLink id={d.id}>
                {kindName(d) || 'Документ'}{!outgoing && <> № <span>{d.number || d.sourceId}</span></>}
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
        ))}
      </Grid>
    </div>
  )
}
