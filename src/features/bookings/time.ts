const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})$/

export const DAY_START_MINUTES = 9 * 60
export const DAY_END_MINUTES = 18 * 60
export const MIN_DURATION_MINUTES = 30
export const MAX_DURATION_MINUTES = 120

export function isValidDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function isValidTime(value: string): boolean {
  const match = TIME_PATTERN.exec(value)
  if (!match) {
    return false
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours <= 23 && minutes <= 59
}

export function timeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value)
  if (!match) {
    return Number.NaN
  }

  return Number(match[1]) * 60 + Number(match[2])
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}
