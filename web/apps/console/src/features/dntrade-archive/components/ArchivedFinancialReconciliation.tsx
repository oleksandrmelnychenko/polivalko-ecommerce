import { Alert, Group, Text } from '@mantine/core'
import { checkArchivedBalances } from '../lib/financialReconciliation'

export function ArchivedFinancialReconciliation({ original }: { original: unknown }) {
  const check = checkArchivedBalances(original)
  if (!check) return null

  const hasComparableRows = check.matched + check.different > 0
  return (
    <Alert title="Перевірка арифметики звіту" color={check.different ? 'orange' : 'gray'} variant="light">
      <Text size="sm">
        Початковий залишок + прихід − розхід = кінцевий залишок. Перевірка охоплює лише суми в цьому збереженому звіті.
      </Text>
      {hasComparableRows ? (
        <Group gap="md" mt="xs">
          <Text size="sm">Збіглися <strong>{check.matched}</strong></Text>
          <Text size="sm">Розбіжності <strong>{check.different}</strong></Text>
          {check.unavailable > 0 ? <Text size="sm">Недоступні для перевірки <strong>{check.unavailable}</strong></Text> : null}
        </Group>
      ) : (
        <Text size="sm" mt="xs">У звіті немає рядків із чотирма сумами в гривнях для перевірки.</Text>
      )}
    </Alert>
  )
}
