import { beforeEach, describe, expect, it } from 'vitest'
import { BOOKINGS_STORAGE_KEY, readBookings, writeBookings } from '../features/bookings/storage.ts'
import type { Booking } from '../features/bookings/types.ts'

const date = '2099-06-15'
const otherDate = '2099-06-16'

function booking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'start' | 'end'>): Booking {
  return { date, ...overrides }
}

function stored(): string | null {
  return localStorage.getItem(BOOKINGS_STORAGE_KEY)
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, init)
}

async function post(body: unknown): Promise<Response> {
  return request('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function patch(id: string, body: unknown): Promise<Response> {
  return request(`/api/bookings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function bookingId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string') {
    return value.id
  }

  throw new Error('Expected a booking id')
}

describe('booking API', () => {
  beforeEach(() => {
    writeBookings(localStorage, [])
  })

  it('returns bookings for the date sorted by start time', async () => {
    writeBookings(localStorage, [
      booking({ id: 'later', start: '14:00', end: '15:00', title: 'Later' }),
      booking({ id: 'earlier', start: '09:30', end: '10:00', title: 'Earlier' }),
      booking({ id: 'other-day', date: otherDate, start: '09:00', end: '10:00' }),
    ])

    const response = await request(`/api/bookings?date=${date}`)
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([
      booking({ id: 'earlier', start: '09:30', end: '10:00', title: 'Earlier' }),
      booking({ id: 'later', start: '14:00', end: '15:00', title: 'Later' }),
    ])
  })

  it('returns bookings for a past date', async () => {
    const old = { id: 'old', date: '2000-01-01', start: '10:00', end: '11:00', title: 'Archive' }
    writeBookings(localStorage, [old])

    const response = await request('/api/bookings?date=2000-01-01')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([old])
  })

  it('returns 400 when the date query is not a real calendar date', async () => {
    const response = await request('/api/bookings?date=2099-02-31')
    expect(response.status).toBe(400)
  })

  it('creates a booking and persists it', async () => {
    const response = await post({
      date,
      start: '09:10',
      end: '09:55',
      title: 'Focus',
    })
    const created: unknown = await response.json()

    expect(response.status).toBe(201)
    expect(created).toMatchObject({ date, start: '09:10', end: '09:55', title: 'Focus' })
    expect(readBookings(localStorage)).toEqual([created])

    const listed = await request(`/api/bookings?date=${date}`)
    expect(await listed.json()).toEqual([created])

    const second = await post({ date, start: '11:00', end: '12:00' })
    const secondBody: unknown = await second.json()
    expect(second.status).toBe(201)
    expect(bookingId(secondBody)).not.toBe(bookingId(created))
  })

  it('updates only the provided fields and persists the result', async () => {
    writeBookings(localStorage, [
      booking({ id: 'edit', start: '10:00', end: '11:00', title: 'Original' }),
    ])

    const response = await patch('edit', { end: '11:30', date: otherDate })
    const updated: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(updated).toEqual({
      id: 'edit',
      date: otherDate,
      start: '10:00',
      end: '11:30',
      title: 'Original',
    })
    expect(readBookings(localStorage)).toEqual([updated])
  })

  it('deletes a booking', async () => {
    writeBookings(localStorage, [booking({ id: 'gone', start: '10:00', end: '11:00' })])

    const response = await request('/api/bookings/gone', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(readBookings(localStorage)).toEqual([])
  })

  it('returns 400 for a malformed request and does not store it', async () => {
    const before = stored()
    const response = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    const body: unknown = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ errors: [expect.objectContaining({ code: 'invalid_json' })] })
    expect(stored()).toBe(before)

    const typed = await post({ date: 1, start: '10:00', end: '11:00' })
    expect(typed.status).toBe(400)
    expect(stored()).toBe(before)
  })

  it('returns 422 for a business-rule violation and does not store it', async () => {
    const before = stored()
    const response = await post({ date: '2000-01-01', start: '10:00', end: '11:00' })
    const body: unknown = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({ errors: [expect.objectContaining({ code: 'past_date' })] })
    expect(stored()).toBe(before)
  })

  it('returns 409 for an overlap and leaves stored bookings unchanged', async () => {
    const existing = [booking({ id: 'held', start: '10:00', end: '11:00', title: 'Held' })]
    writeBookings(localStorage, existing)
    const before = stored()

    const response = await post({ date, start: '10:15', end: '11:15' })
    const body: unknown = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({ errors: [expect.objectContaining({ code: 'overlap' })] })
    expect(stored()).toBe(before)
    expect(readBookings(localStorage)).toEqual(existing)
  })

  it('allows an unchanged edit and rejects an edit onto another booking', async () => {
    const existing = [
      booking({ id: 'a', start: '09:00', end: '10:00', title: 'A' }),
      booking({ id: 'b', start: '11:00', end: '12:00', title: 'B' }),
    ]
    writeBookings(localStorage, existing)

    const same = await patch('a', { start: '09:00', end: '10:00' })
    expect(same.status).toBe(200)

    const before = stored()
    const conflict = await patch('a', { start: '11:00', end: '12:00' })
    expect(conflict.status).toBe(409)
    expect(stored()).toBe(before)
  })

  it('returns 404 for a missing booking and does not change storage', async () => {
    const existing = [booking({ id: 'kept', start: '10:00', end: '11:00' })]
    writeBookings(localStorage, existing)
    const before = stored()

    const patched = await patch('missing', { title: 'Nope' })
    const deleted = await request('/api/bookings/missing', { method: 'DELETE' })

    expect(patched.status).toBe(404)
    expect(deleted.status).toBe(404)
    expect(stored()).toBe(before)
    expect(readBookings(localStorage)).toEqual(existing)
  })
})
