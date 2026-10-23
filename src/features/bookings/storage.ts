import type { Booking } from './types.ts'
import { addLocalDays, formatLocalDate, isValidDate, isValidTime } from './time.ts'

export const BOOKINGS_STORAGE_KEY = 'meeting-room.bookings.v1'

export type BookingStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStoredBooking(value: unknown): Booking | null {
  if (!isRecord(value)) {
    return null
  }

  const { id, date, start, end, title } = value
  if (typeof id !== 'string' || id.length === 0) {
    return null
  }
  if (typeof date !== 'string' || !isValidDate(date)) {
    return null
  }
  if (typeof start !== 'string' || !isValidTime(start)) {
    return null
  }
  if (typeof end !== 'string' || !isValidTime(end)) {
    return null
  }
  if (title !== undefined && typeof title !== 'string') {
    return null
  }

  const booking: Booking = { id, date, start, end }
  if (typeof title === 'string') {
    booking.title = title
  }
  return booking
}

export function createDemoBookings(now: Date): Booking[] {
  const today = formatLocalDate(now)
  const tomorrow = formatLocalDate(addLocalDays(now, 1))

  return [
    {
      id: 'demo-sprint-planning',
      date: today,
      start: '10:00',
      end: '11:00',
      title: 'Sprint planning',
    },
    {
      id: 'demo-design-review',
      date: today,
      start: '15:00',
      end: '16:00',
      title: 'Design review',
    },
    {
      id: 'demo-client-call',
      date: tomorrow,
      start: '09:30',
      end: '10:30',
      title: 'Client call',
    },
  ]
}

function parseStoredBookings(raw: string): { bookings: Booking[]; dirty: boolean } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) {
    return null
  }

  const bookings: Booking[] = []
  let dirty = false

  for (const item of parsed) {
    const booking = readStoredBooking(item)
    if (booking) {
      bookings.push(booking)
    } else {
      dirty = true
    }
  }

  return { bookings, dirty }
}

export function writeBookings(storage: BookingStorage, bookings: readonly Booking[]): void {
  storage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings))
}

export function readBookings(storage: BookingStorage, now = new Date()): Booking[] {
  const raw = storage.getItem(BOOKINGS_STORAGE_KEY)
  if (raw === null) {
    const seeded = createDemoBookings(now)
    writeBookings(storage, seeded)
    return seeded
  }

  const parsed = parseStoredBookings(raw)
  if (!parsed) {
    const seeded = createDemoBookings(now)
    writeBookings(storage, seeded)
    return seeded
  }

  if (!parsed.dirty) {
    return parsed.bookings
  }

  const bookings = parsed.bookings.length > 0 ? parsed.bookings : createDemoBookings(now)
  writeBookings(storage, bookings)
  return bookings
}
