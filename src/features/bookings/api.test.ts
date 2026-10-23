import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../mocks/server.ts'
import { ApiError, createBooking, deleteBooking, getBookings, updateBooking } from './api.ts'
import { writeBookings } from './storage.ts'
import type { Booking } from './types.ts'

const date = '2099-04-02'

function booking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'start' | 'end'>): Booking {
  return { date, ...overrides }
}

describe('booking API client', () => {
  beforeEach(() => {
    writeBookings(localStorage, [booking({ id: 'existing', start: '13:00', end: '14:00', title: 'Existing' })])
  })

  it('returns bookings, created bookings, and updated bookings', async () => {
    const listed = await getBookings(date)
    expect(listed).toEqual([booking({ id: 'existing', start: '13:00', end: '14:00', title: 'Existing' })])

    const created = await createBooking({ date, start: '09:10', end: '09:40', title: 'New' })
    expect(created).toMatchObject({ date, start: '09:10', end: '09:40', title: 'New' })

    const updated = await updateBooking(created.id, { title: 'Renamed' })
    expect(updated).toEqual({ ...created, title: 'Renamed' })
  })

  it('exposes structured validation errors with their status', async () => {
    const error = await createBooking({ date, start: '08:00', end: '08:30' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    if (!(error instanceof ApiError)) {
      return
    }

    expect(error.status).toBe(422)
    expect(error.kind).toBe('validation')
    expect(error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'start', code: 'outside_hours' })]),
    )
  })

  it('exposes conflict errors separately from validation errors', async () => {
    const error = await createBooking({ date, start: '13:15', end: '14:15' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    if (!(error instanceof ApiError)) {
      return
    }

    expect(error.status).toBe(409)
    expect(error.kind).toBe('conflict')
    expect(error.issues.map((issue) => issue.code)).toEqual(['overlap'])
  })

  it('reports network failures without a status code', async () => {
    server.use(
      http.post('/api/bookings', () => {
        return HttpResponse.error()
      }),
    )

    const error = await createBooking({ date, start: '10:00', end: '11:00' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    if (!(error instanceof ApiError)) {
      return
    }

    expect(error.kind).toBe('network')
    expect(error.status).toBe(0)
  })

  it('resolves a successful delete without reading a body', async () => {
    await expect(deleteBooking('existing')).resolves.toBeUndefined()
    await expect(getBookings(date)).resolves.toEqual([])
  })

  it('lets an aborted request reject as an abort', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(getBookings(date, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
