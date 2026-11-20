import { useEffect, useState } from 'react'

const zone = { timeZone: 'Europe/Kyiv' }
const weekday = new Intl.DateTimeFormat('uk-UA', { ...zone, weekday: 'long' })
const date = new Intl.DateTimeFormat('uk-UA', { ...zone, month: 'long', day: 'numeric' })
const time = new Intl.DateTimeFormat('uk-UA', { ...zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function KyivClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function tick() {
      const instant = new Date()
      setNow(instant)
      timer = setTimeout(tick, 60_000 - instant.getTime() % 60_000)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  return <time className="console-clock" dateTime={now?.toISOString()} title="Київський час">
    <span className="console-clock-date">{now && <><b>{weekday.format(now)}</b>{date.format(now)}</>}</span>
    <strong>{now ? time.format(now) : '—'}</strong>
  </time>
}
