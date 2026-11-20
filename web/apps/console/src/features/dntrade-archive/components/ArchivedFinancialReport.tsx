import { Button, Group, Stack, Table, Text } from '@mantine/core'
import { useId, useState } from 'react'
import { apiFetch } from '@/shared/api/client'
import { useApiQuery, type ApiResult } from '@/shared/api/useApiQuery'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { archiveOriginalHref } from '../api/archiveApi'
import type { ArchivePreviewEntityType } from '../lib/archive'
import { parseFinancialReportPreview, type FinancialReportPreview, type ReportField } from '../lib/financialReport'
import { ArchivedFinancialReconciliation } from './ArchivedFinancialReconciliation'

type LoadedReport = { original: unknown; preview: FinancialReportPreview }

async function getReport(id: string): Promise<ApiResult<LoadedReport>> {
  const response = await apiFetch(archiveOriginalHref(id), { cache: 'no-store', redirect: 'error' })
  if (!response.ok) return { response }
  const original: unknown = await response.json()
  return { data: { original, preview: parseFinancialReportPreview(original) }, response }
}

type ReportTable = Extract<FinancialReportPreview, { kind: 'tables' }>['tables'][number]
type TableRows = ReportTable['TBODY']
const reportPageSize = 100
const rowCount = new Intl.NumberFormat('uk-UA')
const cellStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const

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

function ReportTableView({ table, index, paginated }: { table: ReportTable; index: number; paginated: boolean }) {
  const [page, setPage] = useState(1)
  const totalRows = table.TBODY.length
  const start = (page - 1) * reportPageSize
  const end = Math.min(start + reportPageSize, totalRows)
  const body = paginated ? table.TBODY.slice(start, end) : table.TBODY

  return (
    <>
      {paginated ? (
        <Group justify="space-between" gap="xs">
          <Text size="sm" c="dimmed" role="status">Рядки {rowCount.format(start + 1)}–{rowCount.format(end)} з {rowCount.format(totalRows)}</Text>
          <Paginator page={page} pageSize={reportPageSize} totalPages={Math.ceil(totalRows / reportPageSize)} onPageChange={setPage} />
        </Group>
      ) : null}
      <Table.ScrollContainer minWidth={480} type="native">
        <Table aria-label={`Таблиця звіту ${index + 1}`} withTableBorder withColumnBorders styles={{ th: cellStyle, td: cellStyle }}>
          {paginated && table.TFOOT.length ? <Table.Caption>Підсумки за весь звіт</Table.Caption> : null}
          {table.THEAD.length ? <Table.Thead><ReportRows rows={table.THEAD} header /></Table.Thead> : null}
          <Table.Tbody><ReportRows rows={body} /></Table.Tbody>
          {table.TFOOT.length ? <Table.Tfoot><ReportRows rows={table.TFOOT} /></Table.Tfoot> : null}
        </Table>
      </Table.ScrollContainer>
    </>
  )
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

  return (
    <Stack gap="sm">
      <ReportFields fields={preview.fields} />
      <ArchivedFinancialReconciliation original={original} />
      {preview.limited ? (
        <Text size="sm" c="dimmed" role="status">Показано частину звіту. Повні дані доступні в оригіналі.</Text>
      ) : null}
      {preview.tables.map((table, index) => (
        <ReportTableView key={index} table={table} index={index} paginated={preview.paginated} />
      ))}
    </Stack>
  )
}

export function ArchivedFinancialReport({ id, entityType }: { id: string; entityType: ArchivePreviewEntityType }) {
  const [open, setOpen] = useState(false)
  const headingId = useId()
  const contentId = useId()
  const title = entityType === 'bankAccount' ? 'Реквізити рахунку' : 'Дані звіту'

  return (
    <section className="app-split-card" aria-labelledby={headingId}>
      <header className="app-split-card-head">
        <h3 id={headingId}>{title}</h3>
        <Button size="xs" variant="default" aria-controls={contentId} aria-expanded={open} onClick={() => setOpen((visible) => !visible)}>
          {open ? 'Приховати' : 'Показати'}
        </Button>
      </header>
      <div id={contentId}>{open ? <ReportContent id={id} /> : null}</div>
    </section>
  )
}
