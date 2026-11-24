import { Accordion, Alert, Button, Group, Modal, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { money, save, useRegister } from './api'

type Card = components['schemas']['InactiveInventoryProduct']

export function InactiveProductCards({ reportUrl, reloadRows }: { reportUrl: string; reloadRows: () => void }) {
  const url = reportUrl + '/inactive-products'
  const query = useRegister<Card[]>(url)
  const { can } = usePermissions()
  const [chosen, setChosen] = useState<Card | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!chosen || busy) return
    setBusy(true)
    setError('')
    try {
      const { response, error } = await save(url + '/' + chosen.position, {
        evidenceId: chosen.evidenceId,
        evidencePosition: chosen.evidencePosition,
        code: chosen.code,
      })
      if (response.ok) {
        setChosen(null)
        reloadRows()
      } else {
        setError(problemMessage(error, 'Не вдалося створити картку.'))
      }
      query.reload()
    } catch {
      setError('Немає відповіді сервера. Можна повторити створення картки.')
    } finally {
      setBusy(false)
    }
  }

  if (query.data?.length === 0) return null
  return (
    <Accordion variant="contained">
      <Accordion.Item value="inactive">
        <Accordion.Control>
          Деактивовані товари з додатним залишком {query.data && '· ' + query.data.length}
        </Accordion.Control>
        <Accordion.Panel>
          {query.data ? (
            <Stack>
              <Text size="sm">
                Код, назва, одиниця та залишок цих товарів збігаються у двох звітах за той самий склад і дату.
              </Text>
              <Grid
                columns={[
                  'Код',
                  'Товар',
                  'Кількість',
                  'Закупівельна у звіті, грн',
                  'Роздрібна у звіті, грн',
                  'Картка каталогу',
                ]}
              >
                {query.data.map((row) => (
                  <Table.Tr key={row.position}>
                    <Table.Td>
                      <Link to={'/warehouse/inventory?view=inventory&report=' + row.evidenceId + '&q=' + row.code}>
                        {row.code}
                      </Link>
                    </Table.Td>
                    <Table.Td>{row.title}</Table.Td>
                    <Table.Td>
                      {row.quantity} {row.unit}
                    </Table.Td>
                    <Table.Td>{money(String(row.purchasePrice))}</Table.Td>
                    <Table.Td>{money(String(row.retailPrice))}</Table.Td>
                    <Table.Td>
                      {row.productId ? (
                        <Link to={'/catalog/products/' + row.productId}>Відкрити картку</Link>
                      ) : row.status === 'available' && can(PermissionKeys.Catalog.RunImport) ? (
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            setError('')
                            setChosen(row)
                          }}
                        >
                          Створити картку
                        </Button>
                      ) : row.status === 'category' ? (
                        'Потрібна прихована категорія'
                      ) : row.status === 'conflict' ? (
                        'Перевірте наявну картку'
                      ) : (
                        'Очікує створення'
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Grid>
            </Stack>
          ) : (
            <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
          )}
        </Accordion.Panel>
      </Accordion.Item>
      <Modal
        opened={!!chosen}
        onClose={() => {
          if (!busy) setChosen(null)
        }}
        title="Створення прихованої картки"
      >
        {chosen && (
          <Stack>
            <Text fw={600}>
              {chosen.code} · {chosen.title}
            </Text>
            <Text>
              Одиниця виміру · {chosen.unit}
              <br />
              Штрихкод · {chosen.barcode || '—'}
              <br />
              Роздрібна ціна · {money(String(chosen.retailPrice), 'UAH')}
            </Text>
            <Text size="sm">
              Картка буде прихована у магазині. Початковий залишок {chosen.quantity} {chosen.unit} вводиться окремою
              складською операцією.
            </Text>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="end">
              <Button variant="default" disabled={busy} onClick={() => setChosen(null)}>
                Назад
              </Button>
              <Button loading={busy} onClick={create}>
                Створити приховану картку
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Accordion>
  )
}
