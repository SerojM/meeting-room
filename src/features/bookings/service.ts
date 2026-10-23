import type { Booking, BookingIssue } from './types.ts'
import { readBookings, writeBookings, type BookingStorage } from './storage.ts'
import { isValidDate } from './time.ts'
import {
  parseCreateBookingBody,
  parseUpdateBookingBody,
  validateBooking,
  type BookingDraft,
} from './validation.ts'

type FieldError = {
  ok: false
  status: 400 | 409 | 422
  message: string
  errors: BookingIssue[]
}

type NotFound = {
  ok: false
  status: 404
  message: string
}

export type ListBookingsResult = { ok: true; bookings: Booking[] } | FieldError

export type SaveBookingResult = { ok: true; booking: Booking } | FieldError | NotFound

export type DeleteBookingResult = { ok: true } | NotFound

function fieldError(status: FieldError['status'], errors: BookingIssue[]): FieldError {
  return {
    ok: false,
    status,
    message: errors[0]?.message ?? 'Request could not be completed.',
    errors,
  }
}

function compareBookings(a: Booking, b: Booking): number {
  if (a.start < b.start) return -1
  if (a.start > b.start) return 1
  if (a.end < b.end) return -1
  if (a.end > b.end) return 1
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

function toBooking(id: string, draft: BookingDraft): Booking {
  const booking: Booking = {
    id,
    date: draft.date,
    start: draft.start,
    end: draft.end,
  }

  if (draft.title !== undefined) {
    booking.title = draft.title
  }

  return booking
}

export function listBookingsByDate(
  storage: BookingStorage,
  date: string | null,
  now = new Date(),
): ListBookingsResult {
  if (date === null || !isValidDate(date)) {
    return fieldError(400, [
      {
        field: 'date',
        code: 'invalid_date',
        message: 'Enter a date as YYYY-MM-DD.',
      },
    ])
  }

  const bookings = readBookings(storage, now)
    .filter((booking) => booking.date === date)
    .sort(compareBookings)

  return { ok: true, bookings }
}

export function createBookingRecord(
  storage: BookingStorage,
  body: unknown,
  now: Date,
  createId: () => string,
): SaveBookingResult {
  const parsed = parseCreateBookingBody(body)
  if (!parsed.ok) {
    return fieldError(400, parsed.issues)
  }

  const bookings = readBookings(storage, now)
  const validated = validateBooking(parsed.data, { now, bookings })
  if (!validated.ok) {
    return fieldError(validated.status, validated.issues)
  }

  const booking = toBooking(createId(), parsed.data)
  writeBookings(storage, [...bookings, booking])
  return { ok: true, booking }
}

export function updateBookingRecord(
  storage: BookingStorage,
  id: string,
  body: unknown,
  now: Date,
): SaveBookingResult {
  const bookings = readBookings(storage, now)
  const existing = bookings.find((booking) => booking.id === id)
  if (!existing) {
    return { ok: false, status: 404, message: 'Booking not found.' }
  }

  const parsed = parseUpdateBookingBody(body)
  if (!parsed.ok) {
    return fieldError(400, parsed.issues)
  }

  const draft: BookingDraft = {
    date: parsed.data.date ?? existing.date,
    start: parsed.data.start ?? existing.start,
    end: parsed.data.end ?? existing.end,
  }

  if (parsed.data.title !== undefined) {
    draft.title = parsed.data.title
  } else if (existing.title !== undefined) {
    draft.title = existing.title
  }

  const validated = validateBooking(draft, { now, bookings, ignoreId: id })
  if (!validated.ok) {
    return fieldError(validated.status, validated.issues)
  }

  const booking = toBooking(existing.id, draft)
  writeBookings(
    storage,
    bookings.map((item) => (item.id === id ? booking : item)),
  )
  return { ok: true, booking }
}

export function deleteBookingRecord(
  storage: BookingStorage,
  id: string,
  now = new Date(),
): DeleteBookingResult {
  const bookings = readBookings(storage, now)
  if (!bookings.some((booking) => booking.id === id)) {
    return { ok: false, status: 404, message: 'Booking not found.' }
  }

  writeBookings(
    storage,
    bookings.filter((booking) => booking.id !== id),
  )
  return { ok: true }
}
