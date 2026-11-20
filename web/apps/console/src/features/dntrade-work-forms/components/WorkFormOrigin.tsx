import { Anchor, Fieldset, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ARCHIVE_PATH } from '@/features/dntrade-archive/lib/archive'
import { WORK_FORMS_PATH } from '../lib/workForms'

export function WorkFormOrigin({ id, label, error }: { id: string; label?: string; error?: string }) {
  const related = new URLSearchParams({ sourceRecordId: id })
  return (
    <Fieldset legend="Походження" className="dntrade-work-form-group">
      <div className="dntrade-work-form-origin">
        <Text size="sm">
          Архів DNTrade · <Anchor component={Link} to={`${ARCHIVE_PATH}/${id}`}>{label ?? 'Відкрити вихідний запис'}</Anchor>
        </Text>
        <Anchor component={Link} size="sm" to={{ pathname: WORK_FORMS_PATH, search: related.toString() }}>
          Пов’язані робочі форми
        </Anchor>
      </div>
      {error ? <Text c="red" role="alert" size="sm" mt="xs">{error}</Text> : null}
    </Fieldset>
  )
}
