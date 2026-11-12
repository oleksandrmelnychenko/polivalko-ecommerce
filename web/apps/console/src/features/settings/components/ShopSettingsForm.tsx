import { Alert, Button, SimpleGrid, Textarea, TextInput } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconAlertTriangle, IconCalendarEvent, IconDeviceFloppy, IconFileCertificate, IconMapPin, IconPhone, IconShare } from '@tabler/icons-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { saveContacts, saveShopSettings, type Contacts, type ShopSettings } from '../api/settingsApi'
import {
  isPastDay,
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
import { FillState, SettingsCard, SettingsDirty, SettingsHero, SettingsSectionList, useErrorSections, useJumpToErrors, useSettingsSection, type SettingsSection } from './SettingsSplit'
import { SpecialDaysEditor } from './SpecialDaysEditor'

const FORM_ID = 'settings-shop-form'

type ShopSectionKey = 'connection' | 'address' | 'specialDays' | 'social' | 'seller'

const SECTION_KEYS: readonly ShopSectionKey[] = ['connection', 'address', 'specialDays', 'social', 'seller']

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

const CONTACT_SECTION: Record<string, ShopSectionKey> = {
  storephone: 'connection',
  servicesphone: 'connection',
  email: 'connection',
  address: 'address',
  mapurl: 'address',
  schedule: 'address',
  instagram: 'social',
  facebook: 'social',
  telegram: 'social',
  viber: 'social',
  youtube: 'social',
}

function sectionOfField(field: string): ShopSectionKey | null {
  const head = field.split('.')[0]
  if (head === 'seller') return 'seller'
  if (head === 'specialdays') return 'specialDays'
  return CONTACT_SECTION[head] ?? null
}

function filled(values: string[]): number {
  return values.filter((value) => value.trim()).length
}

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
  const [active, select] = useSettingsSection(SECTION_KEYS)
  const invalid = useErrorSections(form.errors, sectionOfField)
  useJumpToErrors(SECTION_KEYS, invalid, active, select)

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

  const c = values.contacts
  const upcoming = values.specialDays.filter((day) => !isPastDay(day.date)).length
  const sellerReady = filled([values.seller.name, values.seller.taxId, values.seller.address, values.seller.iban]) === 4

  const sections: SettingsSection<ShopSectionKey>[] = [
    { key: 'connection', name: "Зв'язок", hint: 'Телефони й email магазину', icon: IconPhone, state: <FillState filled={filled([c.storePhone, c.servicesPhone, c.email])} total={3} /> },
    { key: 'address', name: 'Адреса й графік', hint: 'Адреса, карта і звичайний графік', icon: IconMapPin, state: <FillState filled={filled([c.address, c.mapUrl, c.schedule])} total={3} /> },
    {
      key: 'specialDays',
      name: 'Особливі дні',
      hint: 'Свята, скорочені й передноворічні дні',
      icon: IconCalendarEvent,
      state: upcoming ? <TableChip dot tone="success" value={`Попереду: ${upcoming}`} /> : <TableChip dot tone="neutral" value="Немає" />,
    },
    { key: 'social', name: 'Соцмережі', hint: 'Посилання на сторінки магазину', icon: IconShare, state: <FillState filled={filled([c.instagram, c.facebook, c.telegram, c.viber, c.youTube])} total={5} /> },
    {
      key: 'seller',
      name: 'Реквізити продавця',
      hint: 'Для оферти й фіскальних чеків',
      icon: IconFileCertificate,
      state: sellerReady ? <TableChip dot tone="success" value="Заповнено" /> : <TableChip dot tone="warning" value="Не все заповнено" />,
    },
  ].map((section) => ({ ...section, invalid: invalid.has(section.key as ShopSectionKey) })) as SettingsSection<ShopSectionKey>[]

  const section = sections.find((item) => item.key === active) ?? sections[0]

  function textFields<G extends 'contacts' | 'seller'>(group: G, fields: TextField<string>[], cols: number) {
    return (
      <SimpleGrid cols={cols} spacing="md" verticalSpacing="sm">
        {fields.map((field) => {
          const path = group === 'seller' ? ['seller', field.name] : [field.name]
          const value = (values[group] as Record<string, string>)[field.name]
          return (
            <TextInput
              key={field.name}
              label={field.label}
              type={field.type}
              inputMode={field.type === 'tel' ? 'tel' : field.name === 'taxId' ? 'numeric' : undefined}
              autoComplete="off"
              spellCheck={field.type === 'url' || group === 'seller' ? false : undefined}
              required={field.required}
              description={field.description}
              placeholder={field.placeholder}
              maxLength={field.maxLength ?? (group === 'seller' ? SELLER_LIMITS[field.name as keyof SellerValues] : undefined)}
              value={value}
              error={fieldError(form.errors, ...path)}
              onChange={(event) => setGroup(group, field.name as keyof ShopForm[G], event.currentTarget.value, path)}
            />
          )
        })}
      </SimpleGrid>
    )
  }

  return (
    <ListPage>
      <PageHeader
        title="Магазин"
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
        <form id={FORM_ID} ref={formRef} className="app-split-layout settings-form" onSubmit={onSubmit} noValidate aria-label="Налаштування магазину">
          <SettingsSectionList label="Розділи налаштувань магазину" sections={sections} active={active} onSelect={select} top={form.error ? <FormAlert error={form.error} /> : null} />

          <section key={active} className="app-split-detail" aria-label={section.name}>
            {active === 'connection' ? (
              <>
                <SettingsHero section={section} kicker="Магазин" description="Сайт показує телефони й email на сторінці контактів, на головній і у футері. Порожнє поле на сайті не з'являється." />
                <SettingsCard title="Телефони й email">{textFields('contacts', CONNECTION, 1)}</SettingsCard>
              </>
            ) : null}

            {active === 'address' ? (
              <>
                <SettingsHero section={section} kicker="Магазин" description="Адреса й графік стоять на сторінці контактів, на головній і у футері. Порожнє поле на сайті не з'являється." />
                <SettingsCard title="Де і коли працює магазин">
                  <SimpleGrid cols={1} spacing="md" verticalSpacing="sm">
                    <TextInput
                      label="Адреса магазину"
                      maxLength={SHOP_LIMITS.address}
                      value={c.address}
                      autoComplete="off"
                      error={fieldError(form.errors, 'address')}
                      onChange={(event) => setGroup('contacts', 'address', event.currentTarget.value, ['address'])}
                    />
                    <TextInput
                      label="Посилання на карту"
                      type="url"
                      placeholder="https://maps.app.goo.gl/…"
                      value={c.mapUrl}
                      autoComplete="off"
                      error={fieldError(form.errors, 'mapUrl')}
                      onChange={(event) => setGroup('contacts', 'mapUrl', event.currentTarget.value, ['mapUrl'])}
                    />
                    <Textarea
                      label="Звичайний графік"
                      description="Як на сайті, наприклад: Пн-Пт 9:00-19:00, Сб-Нд 10:00-17:00."
                      autosize
                      minRows={2}
                      maxLength={SHOP_LIMITS.schedule}
                      value={c.schedule}
                      error={fieldError(form.errors, 'schedule')}
                      onChange={(event) => setGroup('contacts', 'schedule', event.currentTarget.value, ['schedule'])}
                    />
                  </SimpleGrid>
                </SettingsCard>
              </>
            ) : null}

            {active === 'specialDays' ? (
              <>
                <SettingsHero section={section} kicker="Магазин" description="Сайт показує особливі дні поруч зі звичайним графіком, поки дата не мине." />
                <SettingsCard title="Дні">
                  <SpecialDaysEditor
                    days={values.specialDays}
                    errors={form.errors}
                    onChange={(specialDays) => setValues((state) => ({ ...state, specialDays }))}
                    onClearField={form.clearField}
                  />
                </SettingsCard>
              </>
            ) : null}

            {active === 'social' ? (
              <>
                <SettingsHero section={section} kicker="Магазин" description="Сайт показує лише заповнені посилання." />
                <SettingsCard title="Посилання">{textFields('contacts', SOCIAL.map((field) => ({ ...field, type: 'url' as const })), 1)}</SettingsCard>
              </>
            ) : null}

            {active === 'seller' ? (
              <>
                <SettingsHero section={section} kicker="Магазин" description="Реквізити стоять в оферті, на сайті під офертою й у фіскальних чеках." />
                <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                  Перед збереженням звірте реквізити з бухгалтером. Уже оформлені замовлення зберігають реквізити на момент оформлення.
                </Alert>
                <SettingsCard title="Реквізити">{textFields('seller', SELLER, 2)}</SettingsCard>
              </>
            ) : null}
          </section>
        </form>
      </ListPageBody>
    </ListPage>
  )
}

function snapshot(form: ShopForm) {
  return { contacts: JSON.stringify(toContactsBody(form)), shop: JSON.stringify(toShopBody(form)) }
}
