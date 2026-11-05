import { Table, Text } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { TableChip, type TableChipTone } from '@/shared/ui/TableChip'
import type { ImportRun } from '../api/catalogApi'

const RUN_STATUS: Record<string, { label: string; tone: TableChipTone }> = {
  running: { label: 'Виконується', tone: 'document' },
  succeeded: { label: 'Успішно', tone: 'success' },
  partiallySucceeded: { label: 'З помилками', tone: 'warning' },
  failed: { label: 'Не виконано', tone: 'danger' },
}

function RunLine({ run, expandable }: { run: ImportRun; expandable: boolean }) {
  const status = RUN_STATUS[run.status] ?? { label: run.status, tone: 'neutral' as const }
  return (
    <>
      {expandable ? <IconChevronRight className="catalog-run-chevron" size={16} stroke={1.8} aria-hidden="true" /> : <span className="catalog-run-chevron" aria-hidden="true" />}
      <TableChip tone={status.tone} dot value={status.label} />
      <span className="catalog-run-meta">
        {formatDateTime(run.startedAt)}, {run.startedBy}
      </span>
      {run.summary ? <span className="catalog-run-text">{run.summary}</span> : null}
    </>
  )
}

export function ImportRunReport({ run, open = false }: { run: ImportRun; open?: boolean }) {
  if (run.errors.length === 0) {
    return (
      <div className="catalog-run">
        <div className="catalog-run-summary">
          <RunLine run={run} expandable={false} />
        </div>
      </div>
    )
  }

  return (
    <details className="catalog-run" open={open || undefined}>
      <summary className="catalog-run-summary">
        <RunLine run={run} expandable />
      </summary>
      <div className="catalog-run-body">
        <div className="catalog-run-table">
          <Table highlightOnHover={false} withTableBorder={false} verticalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="34%">Рядок або артикул</Table.Th>
                <Table.Th>Помилка</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {run.errors.map((error, index) => (
                <Table.Tr key={index}>
                  <Table.Td className="catalog-code">{error.item ?? '—'}</Table.Td>
                  <Table.Td>{error.message}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
        {run.errorCount > run.errors.length ? (
          <Text size="xs" c="dimmed" mt={6}>
            Показано {run.errors.length} з {run.errorCount} помилок.
          </Text>
        ) : null}
      </div>
    </details>
  )
}
