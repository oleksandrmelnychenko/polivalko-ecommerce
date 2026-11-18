const ZONES = ['Europe/Kyiv', 'Europe/Kiev'] as const

const FIELDS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number }

let formatter: Intl.DateTimeFormat | null = null

function kyivFormatter(): Intl.DateTimeFormat {
  if (formatter) return formatter
  for (const timeZone of ZONES) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', { ...FIELDS, timeZone })
      return formatter
    } catch {
      continue
    }
  }
  formatter = new Intl.DateTimeFormat('en-US', FIELDS)
  return formatter
}

function wallClock(instant: number): WallClock {
  const clock: WallClock = { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 }
  for (const part of kyivFormatter().formatToParts(new Date(instant))) {
    if (part.type in clock) clock[part.type as keyof WallClock] = Number(part.value)
  }
  return clock
}

function offsetAt(instant: number): number {
  const clock = wallClock(instant)
  const whole = Math.floor(instant / 1000) * 1000
  return Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour % 24, clock.minute, clock.second) - whole
}

const pad = (value: number) => String(value).padStart(2, '0')

export function kyivDay(date: Date): string {
  const clock = wallClock(date.getTime())
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}`
}

export function kyivInstant(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second)
  const guess = wall - offsetAt(wall)
  return new Date(wall - offsetAt(guess))
}

export function shiftDay(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}
