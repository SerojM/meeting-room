import { addLocalDays, formatLocalDate, isValidDate } from './time.ts'

const longDateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function shiftLocalDate(value: string, days: number): string {
  if (!isValidDate(value)) {
    return value
  }

  const [year, month, day] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return formatLocalDate(addLocalDays(date, days))
}

export function formatLongDate(value: string): string {
  if (!isValidDate(value)) {
    return value
  }

  const [year, month, day] = value.split('-')
  return longDateFormat.format(new Date(Number(year), Number(month) - 1, Number(day)))
}

export function formatTimeRange(start: string, end: string): string {
  return `${start}–${end}`
}
