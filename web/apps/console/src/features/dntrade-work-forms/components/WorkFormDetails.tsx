import { Button, Fieldset, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { IconChevronLeft, IconPencil } from '@tabler/icons-react'
import { Link, type To } from 'react-router-dom'
import { PageHeader } from '@/shared/ui/PageHeader'
import type { WorkFormRecord } from '../api/workFormsApi'
import { WORK_FORM_DIRECTION, workDataFieldLabel, workFormFields, workLineFieldLabel } from '../lib/workFormFields'
import { workFormSectionLabel, workFormTypeLabel } from '../lib/workForms'
import { WorkFormOrigin } from './WorkFormOrigin'
import { WorkFormStatus } from './WorkFormStatus'

const updatedFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' })

function Value({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <Text component="dt" size="sm" c="dimmed">{label}</Text>
      <Text component="dd" size="sm" className="dntrade-work-form-value">{value || '—'}</Text>
    </div>
  )
}

export function WorkFormDetails({ record, backTo, editTo }: { record: WorkFormRecord; backTo: To; editTo: To }) {
  const config = workFormFields(record.type)
  const lines = record.data.lines ?? []

  return (
    <>
      <PageHeader title={record.title} actions={(
        <Group gap="xs">
          <Button component={Link} to={backTo} variant="default" leftSection={<IconChevronLeft size={16} />}>До списку</Button>
          {record.status !== 'archived' ? <Button component={Link} to={editTo} leftSection={<IconPencil size={16} />}>Редагувати</Button> : null}
        </Group>
      )} />
      <div className="dntrade-work-form-body">
        <Stack component="article" className="dntrade-work-form-content" gap="md" aria-label={record.title}>
          <Fieldset legend="Робоча форма" className="dntrade-work-form-group">
            <Group gap="sm">
              <Text component="h2" fw={650} size="lg">{record.title}</Text>
              <WorkFormStatus status={record.status} />
            </Group>
            <SimpleGrid component="dl" cols={{ base: 1, xs: 2, md: 4 }} mt="sm">
              <Value label="Розділ" value={workFormSectionLabel(record.section)} />
              <Value label="Тип форми" value={workFormTypeLabel(record.type)} />
              <Value label="Дата документа" value={record.documentDate?.split('-').reverse().join('.') ?? null} />
              <Value label="Оновлено" value={updatedFormat.format(new Date(record.updatedAt))} />
            </SimpleGrid>
          </Fieldset>
          {record.sourceRecordId ? <WorkFormOrigin id={record.sourceRecordId} /> : null}
          <Fieldset legend={config.details} className="dntrade-work-form-group">
            <SimpleGrid component="dl" cols={{ base: 1, xs: 2, md: 3 }}>
              {config.fields.map((field) => (
                <Value
                  key={field}
                  label={workDataFieldLabel(field, record.type)}
                  value={field === 'direction' ? WORK_FORM_DIRECTION.find(({ value }) => value === record.data.direction)?.label ?? null : record.data[field]}
                />
              ))}
            </SimpleGrid>
          </Fieldset>
          {config.lines.length > 0 ? (
            <Fieldset legend="Товарні рядки" className="dntrade-work-form-group">
              {lines.length ? (
                <Table.ScrollContainer minWidth={480}>
                  <Table striped withRowBorders>
                    <Table.Thead><Table.Tr>
                      {config.lines.map((field) => <Table.Th key={field} scope="col">{workLineFieldLabel(field, record.type)}</Table.Th>)}
                    </Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {lines.map((line, index) => (
                        <Table.Tr key={index}>
                          {config.lines.map((field) => <Table.Td key={field} className="dntrade-work-form-value">{line[field] || '—'}</Table.Td>)}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              ) : <Text size="sm" c="dimmed">Товари ще не додані.</Text>}
            </Fieldset>
          ) : null}
          {record.data.note ? (
            <Fieldset legend="Примітки" className="dntrade-work-form-group">
              <Text className="dntrade-work-form-value" size="sm">{record.data.note}</Text>
            </Fieldset>
          ) : null}
        </Stack>
      </div>
    </>
  )
}
