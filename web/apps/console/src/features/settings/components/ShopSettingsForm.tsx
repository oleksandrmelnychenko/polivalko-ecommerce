import { Alert, Button, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconAlertTriangle, IconDeviceFloppy } from '@tabler/icons-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '@/shared/ui/PageHeader'
import { saveContacts, saveShopSettings, type Contacts, type ShopSettings } from '../api/settingsApi'
import {
  SELLER_LIMITS,
  SHOP_LIMITS,
  toContactsBody,
  toShopBody,
  toShopForm,
  validateShop,
  type ContactValues,
  type SellerValues,
  type ShopForm,
} from '../lib/shopForm'
import { fieldError, useSaveForm, type SaveStep } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { SectionCard } from './SectionCard'
import { SpecialDaysEditor } from './SpecialDaysEditor'

const FORM_ID = 'settings-shop-form'

type ShopSettingsFormProps = {
  contacts: Contacts
  shop: ShopSettings
  onSaved: (contacts: Contacts | null, shop: ShopSettings | null) => void
}

type TextField<K extends string> = {
  name: K
  label: string
  type?: 'tel' | 'email' | 'url'
  placeholder?: string
  description?: string
  required?: boolean
  maxLength?: number
}

const CONNECTION: TextField<keyof ContactValues>[] = [
  { name: 'storePhone', label: 'Телефон магазину', type: 'tel', placeholder: '+380 67 123 45 67', maxLength: SHOP_LIMITS.phone },
  { name: 'servicesPhone', label: 'Телефон послуг', type: 'tel', placeholder: '+380 67 123 45 67', maxLength: SHOP_LIMITS.phone },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'shop@example.com', maxLength: SHOP_LIMITS.email },
]

const SOCIAL: TextField<keyof ContactValues>[] = [
  { name: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { name: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { name: 'telegram', label: 'Telegram', placeholder: 'https://t.me/…' },
  { name: 'viber', label: 'Viber', placeholder: 'viber://chat?number=%2B380671234567' },
  { name: 'youTube', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
]

const SELLER: TextField<keyof SellerValues>[] = [
  { name: 'name', label: 'Назва продавця', placeholder: 'ФОП Іваненко Іван Іванович', required: true },
  { name: 'taxId', label: 'ЄДРПОУ або РНОКПП', placeholder: '1234567890', description: '8 цифр для юрособи, 10 цифр для ФОП.' },
  { name: 'address', label: 'Юридична адреса', placeholder: 'м. Буча, вул. …' },
  { name: 'iban', label: 'IBAN', placeholder: 'UA21 3223 1300 0002 6007 2335 6600 1' },
  { name: 'email', label: 'Email для покупців', type: 'email' },
  { name: 'phone', label: 'Телефон', type: 'tel', placeholder: '+380 67 123 45 67' },
]

export function ShopSettingsForm({ contacts, shop, onSaved }: ShopSettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useSaveForm(formRef)
  const [values, setValues] = useState(() => toShopForm(contacts, shop))
  const [base, setBase] = useState({ contacts, shop })
  const saved = snapshot(toShopForm(base.contacts, base.shop))
  const current = snapshot(values)
  const contactsDirty = current.contacts !== saved.contacts
  const shopDirty = current.shop !== saved.shop
  const dirty = contactsDirty || shopDirty

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useHotkeys([['mod+S', () => formRef.current?.requestSubmit()]], [])

  function setGroup<G extends 'contacts' | 'seller'>(group: G, name: keyof ShopForm[G], value: string, errorPath: string[]) {
    setValues((state) => ({ ...state, [group]: { ...state[group], [name]: value } }))
    form.clearField(...errorPath)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || !dirty) return
    const errors = validateShop(values)
    if (Object.keys(errors).length > 0) {
      form.invalid(errors)
      return
    }
    const contactsBody = toContactsBody(values)
    const shopBody = toShopBody(values)
    const steps: SaveStep[] = []
    if (contactsDirty) steps.push({ send: (headers) => saveContacts(headers, contactsBody), failed: 'Контакти не збережено.' })
    if (shopDirty) steps.push({ send: (headers) => saveShopSettings(headers, shopBody), failed: 'Особливі дні чи реквізити не збережено.' })
    const results = await form.submitAll(steps, 'Налаштування магазину збережено.')
    const contactsResult = contactsDirty ? results.shift() : undefined
    const shopResult = shopDirty ? results.shift() : undefined
    const nextContacts = contactsResult ? ((contactsResult as { data?: Contacts }).data ?? contactsBody) : null
    const nextShop = shopResult ? ((shopResult as { data?: ShopSettings }).data ?? shopBody) : null
    if (!nextContacts && !nextShop) return
    const nextBase = { contacts: nextContacts ?? base.contacts, shop: nextShop ?? base.shop }
    const allSaved = (!contactsDirty || nextContacts !== null) && (!shopDirty || nextShop !== null)
    setBase(nextBase)
    if (allSaved) setValues(toShopForm(nextBase.contacts, nextBase.shop))
    onSaved(nextContacts, nextShop)
  }

  return (
    <div className="settings-page">
      <PageHeader
        title="Магазин"
        actions={
          <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти
          </Button>
        }
      />
      <form id={FORM_ID} ref={formRef} className="settings-form" onSubmit={onSubmit} noValidate aria-label="Налаштування магазину">
        <Stack gap="lg">
          <p className="settings-lead">Контакти, графік і реквізити магазину. Сайт показує їх на сторінці контактів, на головній і у футері. Порожнє поле сайт не показує.</p>
          <FormAlert error={form.error} />

          <SectionCard title="Зв'язок">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" verticalSpacing="sm">
              {CONNECTION.map((field) => (
                <TextInput
                  key={field.name}
                  label={field.label}
                  type={field.type}
                  inputMode={field.type === 'tel' ? 'tel' : undefined}
                  autoComplete="off"
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  value={values.contacts[field.name]}
                  error={fieldError(form.errors, field.name)}
                  onChange={(event) => setGroup('contacts', field.name, event.currentTarget.value, [field.name])}
                />
              ))}
            </SimpleGrid>
          </SectionCard>

          <SectionCard title="Адреса й графік">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
              <TextInput
                label="Адреса магазину"
                maxLength={SHOP_LIMITS.address}
                value={values.contacts.address}
                autoComplete="off"
                error={fieldError(form.errors, 'address')}
                onChange={(event) => setGroup('contacts', 'address', event.currentTarget.value, ['address'])}
              />
              <TextInput
                label="Посилання на карту"
                type="url"
                placeholder="https://maps.app.goo.gl/…"
                value={values.contacts.mapUrl}
                autoComplete="off"
                error={fieldError(form.errors, 'mapUrl')}
                onChange={(event) => setGroup('contacts', 'mapUrl', event.currentTarget.value, ['mapUrl'])}
              />
            </SimpleGrid>
            <Textarea
              mt="sm"
              label="Звичайний графік"
              description="Як на сайті, наприклад: Пн–Пт 9:00–19:00, Сб–Нд 10:00–17:00."
              autosize
              minRows={2}
              maxLength={SHOP_LIMITS.schedule}
              value={values.contacts.schedule}
              error={fieldError(form.errors, 'schedule')}
              onChange={(event) => setGroup('contacts', 'schedule', event.currentTarget.value, ['schedule'])}
            />
          </SectionCard>

          <SectionCard title="Особливі дні" description="Свята, скорочені й передноворічні дні. Сайт показує їх поруч зі звичайним графіком, поки дата не мине.">
            <SpecialDaysEditor
              days={values.specialDays}
              errors={form.errors}
              onChange={(specialDays) => setValues((state) => ({ ...state, specialDays }))}
              onClearField={form.clearField}
            />
          </SectionCard>

          <SectionCard title="Соцмережі">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
              {SOCIAL.map((field) => (
                <TextInput
                  key={field.name}
                  label={field.label}
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  value={values.contacts[field.name]}
                  error={fieldError(form.errors, field.name)}
                  onChange={(event) => setGroup('contacts', field.name, event.currentTarget.value, [field.name])}
                />
              ))}
            </SimpleGrid>
          </SectionCard>

          <SectionCard title="Реквізити продавця">
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />} mb="md">
              Реквізити друкуються в оферті, на сайті під офертою й у фіскальних чеках. Перевірте їх з бухгалтером перед збереженням. Уже оформлені замовлення
              зберігають реквізити на момент оформлення.
            </Alert>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
              {SELLER.map((field) => (
                <TextInput
                  key={field.name}
                  label={field.label}
                  type={field.type}
                  inputMode={field.type === 'tel' ? 'tel' : field.name === 'taxId' ? 'numeric' : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  required={field.required}
                  description={field.description}
                  placeholder={field.placeholder}
                  maxLength={SELLER_LIMITS[field.name]}
                  value={values.seller[field.name]}
                  error={fieldError(form.errors, 'seller', field.name)}
                  onChange={(event) => setGroup('seller', field.name, event.currentTarget.value, ['seller', field.name])}
                />
              ))}
            </SimpleGrid>
          </SectionCard>
        </Stack>
      </form>
    </div>
  )
}

function snapshot(form: ShopForm) {
  return { contacts: JSON.stringify(toContactsBody(form)), shop: JSON.stringify(toShopBody(form)) }
}
