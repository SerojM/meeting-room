import { describe, expect, it } from 'vitest'
import type { Booking } from './types.ts'
import { validateBooking, type ValidationResult } from './validation.ts'

const morning = new Date(2026, 5, 15, 8, 0, 0)
const midday = new Date(2026, 5, 15, 11, 0, 45)
const today = '2026-06-15'
const tomorrow = '2026-06-16'
const yesterday = '2026-06-14'

function booking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'start' | 'end'>): Booking {
  return {
    date: tomorrow,
    ...overrides,
  }
}

function check(
  draft: { date?: string; start: string; end: string },
  options?: { now?: Date; bookings?: Booking[]; ignoreId?: string },
): ValidationResult {
  return validateBooking(
    { date: draft.date ?? tomorrow, start: draft.start, end: draft.end },
    {
      now: options?.now ?? morning,
      bookings: options?.bookings ?? [],
      ignoreId: options?.ignoreId,
    },
  )
}

function expectIssue(result: ValidationResult, status: 400 | 409 | 422, code: string) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    return
  }

  expect(result.status).toBe(status)
  expect(result.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code, message: expect.any(String) })]),
  )
}

describe('validateBooking', () => {
  it('accepts the 09:00 and 18:00 boundaries', () => {
    expect(check({ start: '09:00', end: '10:00' })).toEqual({ ok: true })
    expect(check({ start: '16:00', end: '18:00' })).toEqual({ ok: true })
    expect(check({ start: '17:30', end: '18:00' })).toEqual({ ok: true })
  })

  it('rejects a start before 09:00', () => {
    expectIssue(check({ start: '08:59', end: '09:30' }), 422, 'outside_hours')
  })

  it('rejects an end after 18:00', () => {
    expectIssue(check({ start: '17:00', end: '18:01' }), 422, 'outside_hours')
  })

  it('rejects a start equal to the end', () => {
    expectIssue(check({ start: '10:00', end: '10:00' }), 422, 'start_not_before_end')
  })

  it('rejects an end earlier than the start', () => {
    expectIssue(check({ start: '11:00', end: '10:00' }), 422, 'end_before_start')
  })

  it('accepts a duration of exactly 30 minutes', () => {
    expect(check({ start: '09:00', end: '09:30' })).toEqual({ ok: true })
  })

  it('rejects a duration under 30 minutes', () => {
    expectIssue(check({ start: '09:00', end: '09:29' }), 422, 'duration_too_short')
    expectIssue(check({ start: '17:31', end: '18:00' }), 422, 'duration_too_short')
  })

  it('accepts a duration of exactly 120 minutes', () => {
    expect(check({ start: '09:00', end: '11:00' })).toEqual({ ok: true })
  })

  it('rejects a duration over 120 minutes', () => {
    expectIssue(check({ start: '09:00', end: '11:01' }), 422, 'duration_too_long')
    expectIssue(check({ start: '09:00', end: '18:00' }), 422, 'duration_too_long')
  })

  it('accepts times that are not on a 30-minute grid', () => {
    expect(check({ start: '09:10', end: '09:40' })).toEqual({ ok: true })
    expect(check({ start: '09:07', end: '10:21' })).toEqual({ ok: true })
  })

  it('rejects a full overlap', () => {
    const existing = [booking({ id: 'a', start: '10:00', end: '11:00' })]
    expectIssue(check({ start: '10:00', end: '11:00' }, { bookings: existing }), 409, 'overlap')
  })

  it('rejects a partial overlap', () => {
    const existing = [booking({ id: 'a', start: '10:00', end: '11:00' })]
    expectIssue(check({ start: '10:30', end: '11:30' }, { bookings: existing }), 409, 'overlap')
  })

  it('does not treat the same clock time on another date as an overlap', () => {
    const existing = [booking({ id: 'a', date: tomorrow, start: '10:00', end: '11:00' })]
    expect(check({ date: '2026-06-17', start: '10:00', end: '11:00' }, { bookings: existing })).toEqual({
      ok: true,
    })
  })

  it('rejects a booking contained by another and one that contains another', () => {
    const existing = [booking({ id: 'a', start: '10:00', end: '11:00' })]
    expectIssue(check({ start: '10:15', end: '10:45' }, { bookings: existing }), 409, 'overlap')
    expectIssue(check({ start: '09:30', end: '11:30' }, { bookings: existing }), 409, 'overlap')
  })

  it('allows adjacent bookings and other non-overlapping bookings', () => {
    const existing = [
      booking({ id: 'a', start: '09:00', end: '10:00' }),
      booking({ id: 'b', start: '13:00', end: '14:00' }),
    ]

    expect(check({ start: '10:00', end: '11:00' }, { bookings: existing })).toEqual({ ok: true })
    expect(check({ start: '11:00', end: '12:30' }, { bookings: existing })).toEqual({ ok: true })
    expect(check({ start: '14:00', end: '15:00' }, { bookings: existing })).toEqual({ ok: true })
  })

  it('allows an edit that keeps the original interval', () => {
    const existing = [
      booking({ id: 'a', start: '09:00', end: '10:00' }),
      booking({ id: 'b', start: '11:00', end: '12:00' }),
    ]

    expect(
      check({ start: '09:00', end: '10:00' }, { bookings: existing, ignoreId: 'a' }),
    ).toEqual({ ok: true })
  })

  it('rejects an edit that moves into another booking', () => {
    const existing = [
      booking({ id: 'a', start: '09:00', end: '10:00' }),
      booking({ id: 'b', start: '11:00', end: '12:00' }),
    ]

    expectIssue(
      check({ start: '11:00', end: '12:00' }, { bookings: existing, ignoreId: 'a' }),
      409,
      'overlap',
    )
  })

  it('rejects past dates and allows future dates', () => {
    expectIssue(check({ date: yesterday, start: '10:00', end: '11:00' }), 422, 'past_date')
    expect(check({ date: tomorrow, start: '10:00', end: '11:00' })).toEqual({ ok: true })
  })

  it('rejects a past start today and allows a future start today', () => {
    expectIssue(
      check({ date: today, start: '10:00', end: '11:00' }, { now: midday }),
      422,
      'past_start',
    )
    expect(check({ date: today, start: '12:00', end: '13:00' }, { now: midday })).toEqual({ ok: true })
  })

  it('treats the current local minute as not in the past', () => {
    expect(check({ date: today, start: '11:00', end: '11:30' }, { now: midday })).toEqual({ ok: true })
    expectIssue(
      check({ date: today, start: '10:59', end: '11:30' }, { now: new Date(2026, 5, 15, 11, 1, 0) }),
      422,
      'past_start',
    )
  })

  it('does not treat an early time on a future date as past', () => {
    const evening = new Date(2026, 5, 15, 17, 45, 0)
    expect(check({ date: tomorrow, start: '09:00', end: '10:00' }, { now: evening })).toEqual({ ok: true })
  })

  it('rejects invalid date and time formats without normalizing them', () => {
    expectIssue(check({ date: '2026-02-31', start: '10:00', end: '11:00' }), 400, 'invalid_date')
    expectIssue(check({ date: '2023-02-29', start: '10:00', end: '11:00' }), 400, 'invalid_date')
    expectIssue(check({ date: '2026-6-16', start: '10:00', end: '11:00' }), 400, 'invalid_date')
    expectIssue(check({ date: '16-06-2026', start: '10:00', end: '11:00' }), 400, 'invalid_date')
    expectIssue(check({ start: '9:00', end: '10:00' }), 400, 'invalid_time')
    expectIssue(check({ start: '09:00:00', end: '10:00' }), 400, 'invalid_time')
    expectIssue(check({ start: '24:00', end: '18:00' }), 400, 'invalid_time')
    expectIssue(check({ start: '09:60', end: '10:30' }), 400, 'invalid_time')

    const leapDay = validateBooking(
      { date: '2024-02-29', start: '10:00', end: '11:00' },
      { now: new Date(2024, 1, 1, 8, 0, 0), bookings: [] },
    )
    expect(leapDay).toEqual({ ok: true })
  })
})
