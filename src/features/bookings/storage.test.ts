import { describe, expect, it } from 'vitest'
import { BOOKINGS_STORAGE_KEY, readBookings, type BookingStorage } from './storage.ts'
import { formatLocalDate, timeToMinutes } from './time.ts'

const now = new Date(2026, 9, 23, 12, 0, 0)

function memoryStorage(initial?: string): BookingStorage {
  const values = new Map<string, string>()
  if (initial !== undefined) {
    values.set(BOOKINGS_STORAGE_KEY, initial)
  }

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

describe('booking storage', () => {
  it('seeds a short demo schedule when storage is empty', () => {
    const storage = memoryStorage()
    const bookings = readBookings(storage, now)
    const today = formatLocalDate(now)
    const todays = bookings.filter((booking) => booking.date === today)
    const bookedMinutes = todays.reduce(
      (total, booking) => total + (timeToMinutes(booking.end) - timeToMinutes(booking.start)),
      0,
    )

    expect(todays.length).toBeGreaterThan(0)
    expect(bookedMinutes).toBeLessThanOrEqual(180)
    expect(storage.getItem(BOOKINGS_STORAGE_KEY)).toBe(JSON.stringify(bookings))
  })

  it('keeps an explicit empty list', () => {
    const storage = memoryStorage('[]')
    expect(readBookings(storage, now)).toEqual([])
  })

  it('replaces unreadable data with the demo schedule', () => {
    const storage = memoryStorage('{')
    const bookings = readBookings(storage, now)

    expect(bookings.length).toBeGreaterThan(0)
    expect(storage.getItem(BOOKINGS_STORAGE_KEY)).not.toBe('{')
  })

  it('reseeds when every stored entry is corrupt', () => {
    const storage = memoryStorage(JSON.stringify([{ nope: true }]))
    const bookings = readBookings(storage, now)

    expect(bookings.some((booking) => booking.id === 'demo-sprint-planning')).toBe(true)
  })

  it('drops corrupt entries and keeps valid bookings', () => {
    const valid = { id: 'keep', date: '2099-01-02', start: '10:00', end: '11:00', title: 'Keep' }
    const storage = memoryStorage(JSON.stringify([valid, { id: 'bad', start: 'noon' }]))

    expect(readBookings(storage, now)).toEqual([valid])
    expect(storage.getItem(BOOKINGS_STORAGE_KEY)).toBe(JSON.stringify([valid]))
  })
})
