import { Button, Stack, Table, Text } from '@mantine/core'
import { useId, useState } from 'react'
import { apiFetch } from '@/shared/api/client'
import { useApiQuery, type ApiResult } from '@/shared/api/useApiQuery'
import { PageState } from '@/shared/ui/PageState'
import { archiveOriginalHref } from '../api/archiveApi'
import { parseFinancialReportPreview, type FinancialReportPreview, type ReportField } from '../lib/financialReport'
import { ArchivedFinancialReconciliation } from './ArchivedFinancialReconciliation'

type LoadedReport = { original: unknown; preview: FinancialReportPreview }

async function getReport(id: string): Promise<ApiResult<LoadedReport>> {
  const response = await apiFetch(archiveOriginalHref(id), { cache: 'no-store', redirect: 'error' })
  if (!response.ok) return { response }
  const original: unknown = await response.json()
  return { data: { original, preview: parseFinancialReportPreview(original) }, response }
}

type TableRows = Extract<FinancialReportPreview, { kind: 'tables' }>['tables'][number]['TBODY']

function ReportRows({ rows, header = false }: { rows: TableRows; header?: boolean }) {
  const Cell = header ? Table.Th : Table.Td
  return rows.map((row, rowIndex) => (
    <Table.Tr key={rowIndex}>
      {row.map((cell, cellIndex) => (
        <Cell key={cellIndex} colSpan={cell.colspan} rowSpan={Math.min(cell.rowspan, rows.length - rowIndex)}>
          {cell.value}
        </Cell>
      ))}
    </Table.Tr>
  ))
}

function ReportFields({ fields }: { fields: ReportField[] }) {
  if (!fields.length) return null
  return (
    <dl className="app-split-fields">
      {fields.map(({ label, value }, index) => (
        <div key={index}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReportContent({ id }: { id: string }) {
  const report = useApiQuery(`dntrade-archive-report:${id}`, () => getReport(id))
  if (report.status === 'loading') return <PageState kind="loading" />
  if (report.status === 'forbidden') return <PageState kind="forbidden" />
  if (report.status === 'error' || !report.data) {
    return <PageState kind="error" title="Не вдалося завантажити дані запису" onRetry={report.reload} />
  }

  const { original, preview } = report.data
  if (preview.kind === 'fields') {
    return (
      <Stack gap="md">
        {preview.groups.map(({ title, fields }, index) => (
          <div key={index}>
            {title ? <Text component="h4" size="sm" fw={600} mb="xs">{title}</Text> : null}
            <ReportFields fields={fields} />
          </div>
        ))}
      </Stack>
    )
  }

  if (preview.kind !== 'tables') {
    return (
      <Text size="sm" c="dimmed" role="status">
        {preview.kind === 'empty'
          ? 'Цей запис не містить даних для перегляду. Вихідний запис доступний в оригіналі.'
          : 'Дані цього запису доступні в оригіналі.'}
      </Text>
    )
  }

  const cellStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const
  return (
    <Stack gap="sm">
      <ReportFields fields={preview.fields} />
      <ArchivedFinancialReconciliation original={original} />
      {preview.limited ? (
        <Text size="sm" c="dimmed" role="status">Показано частину звіту. Повні дані доступні в оригіналі.</Text>
      ) : null}
      {preview.tables.map((table, index) => (
        <Table.ScrollContainer key={index} minWidth={480} type="native">
          <Table aria-label={`Таблиця звіту ${index + 1}`} withTableBorder withColumnBorders styles={{ th: cellStyle, td: cellStyle }}>
            {table.THEAD.length ? <Table.Thead><ReportRows rows={table.THEAD} header /></Table.Thead> : null}
            <Table.Tbody><ReportRows rows={table.TBODY} /></Table.Tbody>
            {table.TFOOT.length ? <Table.Tfoot><ReportRows rows={table.TFOOT} /></Table.Tfoot> : null}
          </Table>
        </Table.ScrollContainer>
      ))}
    </Stack>
  )
}

export function ArchivedFinancialReport({ id, entityType }: { id: string; entityType: 'financialReport' | 'bankAccount' }) {
  const [open, setOpen] = useState(false)
  const headingId = useId()
  const contentId = useId()
  const isBankAccount = entityType === 'bankAccount'

  return (
    <section className="app-split-card" aria-labelledby={headingId}>
      <header className="app-split-card-head">
        <h3 id={headingId}>{isBankAccount ? 'Реквізити рахунку' : 'Дані звіту'}</h3>
        <Button size="xs" variant="default" aria-controls={contentId} aria-expanded={open} onClick={() => setOpen((visible) => !visible)}>
          {open ? 'Приховати' : 'Показати'}
        </Button>
      </header>
      <div id={contentId}>{open ? <ReportContent id={id} /> : null}</div>
    </section>
  )
}
