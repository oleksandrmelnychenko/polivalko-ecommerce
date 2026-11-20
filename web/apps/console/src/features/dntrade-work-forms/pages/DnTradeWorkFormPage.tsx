import { Button } from '@mantine/core'
import { useState, type ComponentProps } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { archiveOriginalHref, getArchiveDetail } from '@/features/dntrade-archive/api/archiveApi'
import { apiFetch } from '@/shared/api/client'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getWorkForm, type SaveWorkForm, type WorkFormRecord } from '../api/workFormsApi'
import { WorkFormDetails } from '../components/WorkFormDetails'
import { WorkFormEditor } from '../components/WorkFormEditor'
import { archivePrefill, archivePrefillTemplate } from '../lib/archivePrefill'
import { openingBalanceChoices } from '../lib/openingBalanceChoices'
import { useWorkFormAccess } from '../lib/useWorkFormAccess'
import { emptyWorkFormData } from '../lib/workFormFields'
import { WORK_FORMS_PATH, WORK_FORM_TYPES, readWorkFormType, workFormPreset } from '../lib/workForms'
import './work-forms.css'

const validId = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) && id !== '00000000-0000-0000-0000-000000000000'

async function loadOrigin(id: string) {
  const result = await getArchiveDetail(id)
  if (!result.response.ok || !result.data) return { response: result.response, error: result.error }
  const detail = result.data
  const sourceDay = detail.sourceDate?.slice(0, 10) ?? ''
  const template = archivePrefillTemplate(detail)
  let original: unknown = null
  let incomplete = false
  if (template) {
    try {
      const response = await apiFetch(archiveOriginalHref(id))
      if (response.ok) original = await response.json()
      else incomplete = true
    } catch {
      incomplete = true
    }
  }
  return {
    response: result.response,
    data: {
      label: detail.sourceId,
      seed: archivePrefill(detail, original) ?? {
        section: 'directory' as const,
        type: 'reference' as const,
        title: (detail.documentType || detail.sourceId).slice(0, 200),
        documentDate: /^\d{4}-\d{2}-\d{2}$/.test(sourceDay) ? sourceDay : null,
        sourceRecordId: detail.id,
        data: emptyWorkFormData(),
      },
      choices: template ? openingBalanceChoices(detail, original) : [],
      incomplete,
    },
  }
}

type NewEditorProps = Omit<ComponentProps<typeof WorkFormEditor>, 'id' | 'version' | 'currentTo'> & { search: string }

function NewWorkFormEditor({ search, ...props }: NewEditorProps) {
  const [id] = useState(() => crypto.randomUUID())
  return <WorkFormEditor {...props} id={id} version={null} currentTo={{ pathname: `${WORK_FORMS_PATH}/${id}`, search }} />
}

export function DnTradeWorkFormPage() {
  const { allowed, isLoading: checkingAccess } = useWorkFormAccess()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const creating = id === 'new'
  const editing = params.get('mode') === 'edit'
  const preset = workFormPreset(params)
  const sourceId = creating ? preset.sourceRecordId : null
  const wrongId = creating ? sourceId !== null && !validId(sourceId) : !validId(id)
  const formQuery = useApiQuery(`dntrade-work-form:${id}:${editing ? 'edit' : 'view'}`, () => getWorkForm(id), { enabled: allowed && !creating && !wrongId })
  const linkedOpeningBalance = editing && formQuery.data?.type === 'opening-balance' && formQuery.data.status !== 'archived' ? formQuery.data.sourceRecordId : null
  const originId = sourceId ?? linkedOpeningBalance
  const origin = useApiQuery(`dntrade-work-form-origin:${originId}`, () => loadOrigin(originId ?? ''), { enabled: allowed && originId !== null && !wrongId })

  const listParams = new URLSearchParams(params)
  for (const key of ['mode', 'archiveId', 'type']) listParams.delete(key)
  const search = listParams.toString()
  const listTo = { pathname: WORK_FORMS_PATH, search }
  const viewTo = { pathname: `${WORK_FORMS_PATH}/${id}`, search }
  const editTo = { ...viewTo, search: new URLSearchParams([...listParams, ['mode', 'edit']]).toString() }

  function onSaved(record: WorkFormRecord) {
    notifySuccess('Робочу форму збережено.')
    formQuery.setData(record)
    navigate({ pathname: `${WORK_FORMS_PATH}/${record.id}`, search }, { replace: true })
  }

  let body
  if (!allowed) {
    body = <PageState kind={checkingAccess ? 'loading' : 'forbidden'} />
  } else if (wrongId) {
    body = <PageState kind="empty" title={creating ? 'Некоректне посилання на архів' : 'Робочу форму не знайдено'} />
  } else if (creating) {
    if (sourceId && (origin.status !== 'ready' || !origin.data)) {
      body = (
        <PageState
          kind={origin.status === 'ready' ? 'error' : origin.status}
          description={problemMessage(origin.problem, 'Не вдалося завантажити пов’язаний запис архіву DNTrade.')}
          onRetry={origin.status === 'error' || origin.status === 'ready' ? origin.reload : undefined}
        />
      )
    } else {
      const source = origin.data
      const explicitType = readWorkFormType(params.get('type'))
      const seed = source?.seed ?? {
        section: preset.section, type: preset.type, title: '', documentDate: null, sourceRecordId: null, data: emptyWorkFormData(),
      }
      const initial: Omit<SaveWorkForm, 'expectedVersion'> = {
        ...seed,
        section: explicitType ? WORK_FORM_TYPES[explicitType].section : seed.section,
        type: explicitType ?? seed.type,
        data: explicitType && explicitType !== seed.type ? emptyWorkFormData() : seed.data,
        status: 'draft',
      }
      return (
        <ListPage>
          <NewWorkFormEditor
            key={`new:${sourceId ?? ''}:${initial.type}`}
            initial={initial}
            search={search}
            originLabel={source?.label}
            originWarning={source?.incomplete ? 'Вихідні поля не вдалося завантажити. Їх можна заповнити вручну.' : undefined}
            openingChoices={source?.choices}
            cancelTo={listTo}
            onSaved={onSaved}
          />
        </ListPage>
      )
    }
  } else if (formQuery.status === 'ready' && formQuery.data) {
    const record = formQuery.data
    return (
      <ListPage>
        {editing && record.status !== 'archived' ? (
          <WorkFormEditor
            key={`${record.id}:${record.version}`}
            initial={record}
            id={record.id}
            version={record.version}
            originLabel={origin.data?.label}
            openingChoices={origin.data?.choices}
            currentTo={viewTo}
            cancelTo={viewTo}
            onSaved={onSaved}
          />
        ) : (
          <WorkFormDetails record={record} backTo={listTo} editTo={editTo} />
        )}
      </ListPage>
    )
  } else {
    const notFound = formQuery.problem?.code === 'dntrade.work_form_not_found'
    body = (
      <PageState
        kind={notFound ? 'empty' : formQuery.status === 'ready' ? 'error' : formQuery.status}
        title={notFound ? 'Робочу форму не знайдено' : undefined}
        description={notFound ? undefined : problemMessage(formQuery.problem, 'Не вдалося відкрити робочу форму.')}
        onRetry={!notFound && formQuery.status === 'error' ? formQuery.reload : undefined}
      />
    )
  }

  return (
    <ListPage>
      <PageHeader title="Робочі форми DNTrade" actions={<Button component={Link} to={listTo} variant="default">До списку</Button>} />
      <ListPageBody>{body}</ListPageBody>
    </ListPage>
  )
}
