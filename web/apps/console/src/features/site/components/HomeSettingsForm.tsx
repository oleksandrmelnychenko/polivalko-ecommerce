import { Button, Stack, Textarea, TextInput } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getBanners, saveHome, type HomeSettings } from '../api/siteApi'
import { DEFAULT_PERKS, DEFAULT_STEPS, DEFAULT_VISIT, itemRows, LIMITS, toHomeBody, toHomeForm, validateHome, type HomeForm } from '../lib/homeSettings'
import { periodState } from '../lib/period'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { AnnouncementFields } from './AnnouncementFields'
import { FormAlert } from './FormAlert'
import { HomeBlocksList } from './HomeBlocksList'
import { ItemsEditor } from './ItemsEditor'
import { SectionCard } from './SectionCard'

const FORM_ID = 'site-home-form'

type HomeSettingsFormProps = {
  initial: HomeSettings
  onSaved: (value: HomeSettings) => void
}

export function HomeSettingsForm({ initial, onSaved }: HomeSettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useSaveForm(formRef)
  const [values, setValues] = useState(() => toHomeForm(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(toHomeBody(toHomeForm(initial))))
  const dirty = JSON.stringify(toHomeBody(values)) !== saved
  const banners = useApiQuery('site-banners', () => getBanners())
  const liveBanners = banners.data ? banners.data.filter((banner) => periodState(banner.isActive, banner.startsAt, banner.endsAt) === 'live').length : null

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useHotkeys([['mod+S', () => formRef.current?.requestSubmit()]], [])

  function patch(next: Partial<HomeForm>) {
    setValues((current) => ({ ...current, ...next }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || !dirty) return
    const errors = validateHome(values)
    if (Object.keys(errors).length > 0) {
      form.invalid(errors)
      return
    }
    const body = toHomeBody(values)
    const result = await form.submit((headers) => saveHome(headers, body), {
      done: 'Головну збережено.',
      failed: 'Налаштування головної не збережено.',
    })
    if (!result) return
    const next = result.data ?? body
    const nextForm = toHomeForm(next)
    setValues(nextForm)
    setSaved(JSON.stringify(toHomeBody(nextForm)))
    onSaved(next)
  }

  const heroNote =
    liveBanners === null ? null : liveBanners === 0 ? (
      <span className="site-warning-text">
        Зараз не показується жоден банер. <Link to="/site/banners">Відкрити банери</Link>
      </span>
    ) : (
      <span>
        Показується банерів: {liveBanners}. <Link to="/site/banners">Відкрити банери</Link>
      </span>
    )

  return (
    <div className="site-page">
      <PageHeader
        title="Головна"
        actions={
          <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти зміни
          </Button>
        }
      />
      <form id={FORM_ID} ref={formRef} className="site-form" onSubmit={onSubmit} noValidate aria-label="Налаштування головної сторінки">
        <Stack gap="lg">
          <p className="site-lead">Що показує головна сторінка сайту і в якому порядку. Зміни з&apos;являються на сайті після збереження.</p>
          <FormAlert error={form.error} />
          <div className="site-columns">
            <SectionCard title="Блоки й порядок" description="Вимкнений блок зникає з головної. Решта йде в цьому порядку зверху вниз.">
              <HomeBlocksList blocks={values.blocks} notes={{ hero: heroNote }} onChange={(blocks) => patch({ blocks })} />
            </SectionCard>
            <SectionCard title="Смуга оголошення" description="Короткий рядок над шапкою сайту, наприклад про початок сезону чи вихідні дні.">
              <AnnouncementFields value={values.announcement} errors={form.errors} onChange={(announcement) => patch({ announcement })} onClearField={form.clearField} />
            </SectionCard>
          </div>
          <SectionCard
            title="Переваги"
            description="Стоять в один ряд під добірками, найкраще виглядають 4 пункти."
            actions={
              <Button variant="subtle" size="xs" color="gray" leftSection={<IconRestore size={14} stroke={1.8} />} onClick={() => patch({ perks: itemRows(DEFAULT_PERKS) })}>
                Повернути типові тексти
              </Button>
            }
          >
            <ItemsEditor
              name="perks"
              noun="Перевага"
              items={values.perks}
              max={LIMITS.perks}
              errors={form.errors}
              onChange={(perks) => patch({ perks })}
              onClearField={form.clearField}
            />
          </SectionCard>
          <SectionCard
            title="Як замовити"
            description="Кроки покупки під заголовком «Як замовити». Номери кроків сайт ставить сам."
            actions={
              <Button variant="subtle" size="xs" color="gray" leftSection={<IconRestore size={14} stroke={1.8} />} onClick={() => patch({ steps: itemRows(DEFAULT_STEPS) })}>
                Повернути типові тексти
              </Button>
            }
          >
            <ItemsEditor
              name="steps"
              noun="Крок"
              items={values.steps}
              max={LIMITS.steps}
              errors={form.errors}
              onChange={(steps) => patch({ steps })}
              onClearField={form.clearField}
            />
          </SectionCard>
          <SectionCard
            title="Наш магазин"
            description={
              <>
                Заголовок і підзаголовок блоку. Адресу, графік і телефон сайт бере з <Link to="/settings/shop">Налаштування → Магазин</Link>.
              </>
            }
            actions={
              <Button variant="subtle" size="xs" color="gray" leftSection={<IconRestore size={14} stroke={1.8} />} onClick={() => patch({ visit: { ...DEFAULT_VISIT } })}>
                Повернути типові тексти
              </Button>
            }
          >
            <div className="site-visit-fields">
              <TextInput
                label="Заголовок"
                value={values.visit.title}
                maxLength={LIMITS.visitTitle}
                required
                error={fieldError(form.errors, 'visit', 'title')}
                onChange={(event) => {
                  patch({ visit: { ...values.visit, title: event.currentTarget.value } })
                  form.clearField('visit', 'title')
                }}
              />
              <Textarea
                label="Підзаголовок"
                value={values.visit.text}
                maxLength={LIMITS.visitText}
                autosize
                minRows={2}
                error={fieldError(form.errors, 'visit', 'text')}
                onChange={(event) => {
                  patch({ visit: { ...values.visit, text: event.currentTarget.value } })
                  form.clearField('visit', 'text')
                }}
              />
            </div>
          </SectionCard>
        </Stack>
      </form>
    </div>
  )
}
