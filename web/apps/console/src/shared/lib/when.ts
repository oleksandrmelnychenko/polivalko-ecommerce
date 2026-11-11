const kyivDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' })
const kyivTime = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })
const kyivDate = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })

export function moment(iso: string): { day: string; time: string } {
  const date = new Date(iso)
  const key = kyivDay.format(date)
  const now = Date.now()
  const day = key === kyivDay.format(now) ? 'сьогодні' : key === kyivDay.format(now - 86_400_000) ? 'вчора' : kyivDate.format(date)
  return { day, time: kyivTime.format(date) }
}

export function shortWhen(iso: string | null | undefined): string {
  if (!iso) return 'немає'
  const { day, time } = moment(iso)
  return `${day} о ${time}`
}
