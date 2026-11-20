import { Table } from '@mantine/core'
import type { ReactNode } from 'react'

export function Grid({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="register-scroll">
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column}>{column}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </div>
  )
}
