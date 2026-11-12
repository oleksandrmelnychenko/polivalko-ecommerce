import { Button, Stack, Switch, TagsInput } from '@mantine/core'
import { IconBell, IconBrandTelegram, IconDeviceFloppy, IconMail, IconSend } from '@tabler/icons-react'
import { useEffect, useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { TableChip } from '@/shared/ui/TableChip'
import { saveNotificationSettings, sendTestNotification, type NotificationEvents, type NotificationSettings } from '../api/settingsApi'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { SettingsCard, SettingsDirty, SettingsHero, SettingsSectionList, useErrorSections, useJumpToErrors, useSettingsSection, type SettingsSection } from './SettingsSplit'

const FORM_ID = 'settings-notifications-form'

type NotificationSectionKey = 'telegram' | 'email' | 'events'

const SECTION_KEYS: readonly NotificationSectionKey[] = ['telegram', 'email', 'events']

function sectionOfField(field: string): NotificationSectionKey | null {
  if (field.startsWith('telegramchatids')) return 'telegram'
  if (field.startsWith('emails')) return 'email'
  return null
}
const CHAT_ID = /^(-?\d{5,20}|@[A-Za-z0-9_]{5,32})$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RECIPIENTS = 10

const EVENTS: { key: keyof NotificationEvents; label: string; description: string }[] = [
  { key: 'newOrder', label: 'Нове замовлення', description: 'Номер, сума, спосіб отримання й оплати.' },
  { key: 'newServiceRequest', label: 'Нова заявка на послугу', description: "Напрямок, ім'я й телефон покупця." },
  { key: 'integrationAlert', label: 'Збій інтеграції', description: 'Navkolo, оплата, чеки чи Нова пошта не відповідають кілька разів поспіль.' },
  { key: 'paymentAfterCancel', label: 'Оплата скасованого замовлення', description: 'Гроші надійшли після скасування: потрібне повернення.' },
]

type Values = { telegramChatIds: string[]; emails: string[]; events: NotificationEvents }

function toValues(value: Partial<NotificationSettings>): Values {
  return {
    telegramChatIds: value.telegramChatIds ?? [],
    emails: value.emails ?? [],
    events: {
      newOrder: value.events?.newOrder ?? true,
      newServiceRequest: value.events?.newServiceRequest ?? true,
      integrationAlert: value.events?.integrationAlert ?? true,
      paymentAfterCancel: value.events?.paymentAfterCancel ?? true,
    },
  }
}

function clean(list: string[]): string[] {
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))]
}

function toBody(values: Values): Values {
  return { telegramChatIds: clean(values.telegramChatIds), emails: clean(values.emails.map((email) => email.toLowerCase())), events: { ...values.events } }
}

function validate(values: Values): Record<string, string> {
  const errors: Record<string, string> = {}
  const badChats = values.telegramChatIds.filter((id) => !CHAT_ID.test(id))
  if (badChats.length > 0) errors.telegramChatIds = `Не схоже на ID чату: ${badChats.join(', ')}. Приклад: -1001234567890.`
  const badEmails = values.emails.filter((email) => !EMAIL.test(email))
  if (badEmails.length > 0) errors.emails = `Перевірте адреси: ${badEmails.join(', ')}.`
  return errors
}

type NotificationSettingsFormProps = {
  initial: NotificationSettings
  onSaved: (value: NotificationSettings) => void
}

export function NotificationSettingsForm({ initial, onSaved }: NotificationSettingsFormProps) {
  const form = useSaveForm()
  const [values, setValues] = useState(() => toValues(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(toBody(toValues(initial))))
  const [testing, setTesting] = useState(false)
  const dirty = JSON.stringify(toBody(values)) !== saved
  const configured = initial.telegramConfigured
  const savedChats = (JSON.parse(saved) as Values).telegramChatIds.length
  const [active, select] = useSettingsSection(SECTION_KEYS)
  const invalid = useErrorSections(form.errors, sectionOfField)
  useJumpToErrors(SECTION_KEYS, invalid, active, select)

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || !dirty) return
    const body = toBody(values)
    const errors = validate(body)
    if (Object.keys(errors).length > 0) {
      form.invalid(errors)
      return
    }
    const result = await form.submit((headers) => saveNotificationSettings(headers, body), { done: 'Налаштування сповіщень збережено.', failed: 'Налаштування сповіщень не збережено.' })
    if (!result) return
    const next = { ...initial, ...body, ...result.data }
    const nextValues = toValues(next)
    setValues(nextValues)
    setSaved(JSON.stringify(toBody(nextValues)))
    onSaved(next)
  }

  async function sendTest() {
    setTesting(true)
    try {
      const result = await withCsrf((headers) => sendTestNotification(headers))
      if (!result.data) notifyError(problemMessage(result.error, 'Тестове повідомлення не надіслано.'))
      else if (result.data.delivered >= result.data.chats) notifySuccess(`Тестове повідомлення доставлено в чати: ${result.data.delivered}. Перевірте Telegram.`)
      else notifyError(`Доставлено лише в ${result.data.delivered} з ${result.data.chats} чатів. Перевірте ID чатів і чи є бот у цих групах.`)
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setTesting(false)
  }

  const telegramState =
    configured === false ? (
      <TableChip dot tone="warning" value="Бот не налаштований" />
    ) : values.telegramChatIds.length ? (
      <TableChip dot tone="success" value={`Чатів: ${values.telegramChatIds.length}`} />
    ) : (
      <TableChip dot tone="neutral" value="Чат із конфігурації" />
    )
  const enabledEvents = EVENTS.filter((item) => values.events[item.key]).length

  const sections: SettingsSection<NotificationSectionKey>[] = [
    { key: 'telegram', name: 'Telegram', hint: 'Бот надсилає повідомлення в чати й групи', icon: IconBrandTelegram, state: telegramState, invalid: invalid.has('telegram') },
    {
      key: 'email',
      name: 'Email',
      hint: 'Листи про ті самі події',
      icon: IconMail,
      state: values.emails.length ? <TableChip dot tone="success" value={`Адрес: ${values.emails.length}`} /> : <TableChip dot tone="neutral" value="Адрес немає" />,
      invalid: invalid.has('email'),
    },
    {
      key: 'events',
      name: 'Події',
      hint: 'Про що повідомляти',
      icon: IconBell,
      state: <TableChip dot tone={enabledEvents ? 'success' : 'neutral'} value={enabledEvents === EVENTS.length ? 'Усі ввімкнено' : `Увімкнено ${enabledEvents} з ${EVENTS.length}`} />,
    },
  ]
  const section = sections.find((item) => item.key === active) ?? sections[0]

  return (
    <ListPage>
      <PageHeader
        title="Сповіщення"
        actions={
          <>
            <SettingsDirty dirty={dirty} />
            <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
              Зберегти зміни
            </Button>
          </>
        }
      />
      <ListPageBody>
        <form id={FORM_ID} className="app-split-layout settings-form" onSubmit={onSubmit} noValidate aria-label="Налаштування сповіщень">
          <SettingsSectionList label="Канали й події сповіщень" sections={sections} active={active} onSelect={select} top={form.error ? <FormAlert error={form.error} /> : null} />

          <section key={active} className="app-split-detail" aria-label={section.name}>
            {active === 'telegram' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Сповіщення"
                  description="Хто й про що дізнається одразу: нові замовлення, заявки на послуги та збої. Бот надсилає повідомлення в усі вказані чати й групи; додайте бота в групу, перш ніж вказувати її ID."
                  actions={
                    <Button
                      variant="default"
                      leftSection={<IconSend size={16} stroke={1.8} />}
                      loading={testing}
                      disabled={configured === false || dirty}
                      title={dirty ? 'Спершу збережіть зміни' : configured === false ? 'Бот не налаштований на сервері' : undefined}
                      onClick={() => void sendTest()}
                    >
                      Тестове повідомлення
                    </Button>
                  }
                />
                <SettingsCard title="Бот">
                  <div className="settings-inline">
                    {configured === false ? (
                      <TableChip dot tone="warning" value="Бот не налаштований" />
                    ) : configured ? (
                      <TableChip dot tone="success" value="Бот підключений" />
                    ) : null}
                    <span className="settings-muted">
                      {configured === false
                        ? 'Токен бота задає розробник у конфігурації сервера. Поки токена немає, сервер лише записує повідомлення у свій журнал.'
                        : 'Токен бота зберігається в конфігурації сервера, у консолі його немає.'}
                    </span>
                  </div>
                </SettingsCard>
                <SettingsCard title="Чати й групи">
                  <TagsInput
                    label="ID чатів"
                    description={
                      savedChats === 0
                        ? 'Список порожній: повідомлення йдуть у чат із конфігурації сервера, якщо він заданий. Введіть ID і натисніть Enter.'
                        : 'ID чату або групи, наприклад -1001234567890. Введіть ID і натисніть Enter.'
                    }
                    placeholder={values.telegramChatIds.length < MAX_RECIPIENTS ? 'ID чату' : undefined}
                    value={values.telegramChatIds}
                    maxTags={MAX_RECIPIENTS}
                    splitChars={[',', ' ', ';']}
                    clearable
                    acceptValueOnBlur
                    error={fieldError(form.errors, 'telegramChatIds')}
                    onChange={(telegramChatIds) => {
                      setValues((current) => ({ ...current, telegramChatIds }))
                      form.clearField('telegramChatIds')
                    }}
                  />
                </SettingsCard>
              </>
            ) : null}

            {active === 'email' ? (
              <>
                <SettingsHero section={section} kicker="Сповіщення" description="Адреси для листів про ті самі події. Сайт надсилає листи, лише коли на сервері налаштовано пошту." />
                <SettingsCard title="Адреси">
                  <TagsInput
                    label="Email"
                    description="Введіть адресу й натисніть Enter."
                    placeholder={values.emails.length < MAX_RECIPIENTS ? 'manager@example.com' : undefined}
                    value={values.emails}
                    maxTags={MAX_RECIPIENTS}
                    splitChars={[',', ' ', ';']}
                    clearable
                    acceptValueOnBlur
                    error={fieldError(form.errors, 'emails')}
                    onChange={(emails) => {
                      setValues((current) => ({ ...current, emails }))
                      form.clearField('emails')
                    }}
                  />
                </SettingsCard>
              </>
            ) : null}

            {active === 'events' ? (
              <>
                <SettingsHero section={section} kicker="Сповіщення" description="Про вимкнені події сайт не повідомляє ні в Telegram, ні на пошту." />
                <SettingsCard title="Події">
                  <Stack gap="md">
                    {EVENTS.map((item) => (
                      <Switch
                        key={item.key}
                        label={item.label}
                        description={item.description}
                        checked={values.events[item.key]}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked
                          setValues((current) => ({ ...current, events: { ...current.events, [item.key]: checked } }))
                        }}
                      />
                    ))}
                  </Stack>
                </SettingsCard>
              </>
            ) : null}
          </section>
        </form>
      </ListPageBody>
    </ListPage>
  )
}
