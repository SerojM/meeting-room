import type { Booking, BookingIssue, CreateBookingInput, UpdateBookingInput } from './types.ts'
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  formatLocalDate,
  isValidDate,
  isValidTime,
  timeToMinutes,
} from './time.ts'

export type BookingDraft = {
  date: string
  start: string
  end: string
  title?: string
}

export type ValidationSuccess = { ok: true }

export type ValidationFailure = {
  ok: false
  status: 400 | 422 | 409
  issues: BookingIssue[]
}

export type ValidationResult = ValidationSuccess | ValidationFailure

type ParseSuccess<T> = { ok: true; data: T }
type ParseFailure = { ok: false; issues: BookingIssue[] }
type ParseResult<T> = ParseSuccess<T> | ParseFailure

type ValidateBookingOptions = {
  now: Date
  bookings: readonly Booking[]
  ignoreId?: string
}

function issue(field: BookingIssue['field'], code: string, message: string): BookingIssue {
  return { field, code, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(
  value: unknown,
  field: 'date' | 'start' | 'end',
  label: string,
): string | BookingIssue {
  if (value === undefined) {
    return issue(field, 'required', `${label} is required.`)
  }

  if (typeof value !== 'string') {
    return issue(field, 'invalid_type', `${label} must be a string.`)
  }

  return value
}

function readOptionalString(
  record: Record<string, unknown>,
  field: 'date' | 'start' | 'end' | 'title',
  label: string,
): string | undefined | BookingIssue {
  if (!Object.hasOwn(record, field)) {
    return undefined
  }

  const value = record[field]
  if (typeof value !== 'string') {
    return issue(field, 'invalid_type', `${label} must be a string.`)
  }

  return value
}

export function parseCreateBookingBody(value: unknown): ParseResult<CreateBookingInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [issue('form', 'invalid_body', 'Request body must be an object.')],
    }
  }

  const date = readRequiredString(value.date, 'date', 'Date')
  const start = readRequiredString(value.start, 'start', 'Start')
  const end = readRequiredString(value.end, 'end', 'End')
  const title = readOptionalString(value, 'title', 'Title')

  if (
    typeof date !== 'string' ||
    typeof start !== 'string' ||
    typeof end !== 'string' ||
    (title !== undefined && typeof title !== 'string')
  ) {
    const issues: BookingIssue[] = []
    if (typeof date !== 'string') issues.push(date)
    if (typeof start !== 'string') issues.push(start)
    if (typeof end !== 'string') issues.push(end)
    if (title !== undefined && typeof title !== 'string') issues.push(title)
    return { ok: false, issues }
  }

  const data: CreateBookingInput = { date, start, end }
  if (title !== undefined) {
    data.title = title
  }

  return { ok: true, data }
}

export function parseUpdateBookingBody(value: unknown): ParseResult<UpdateBookingInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [issue('form', 'invalid_body', 'Request body must be an object.')],
    }
  }

  const date = readOptionalString(value, 'date', 'Date')
  const start = readOptionalString(value, 'start', 'Start')
  const end = readOptionalString(value, 'end', 'End')
  const title = readOptionalString(value, 'title', 'Title')

  if (
    (date !== undefined && typeof date !== 'string') ||
    (start !== undefined && typeof start !== 'string') ||
    (end !== undefined && typeof end !== 'string') ||
    (title !== undefined && typeof title !== 'string')
  ) {
    const issues: BookingIssue[] = []
    if (date !== undefined && typeof date !== 'string') issues.push(date)
    if (start !== undefined && typeof start !== 'string') issues.push(start)
    if (end !== undefined && typeof end !== 'string') issues.push(end)
    if (title !== undefined && typeof title !== 'string') issues.push(title)
    return { ok: false, issues }
  }

  const data: UpdateBookingInput = {}
  if (date !== undefined) data.date = date
  if (start !== undefined) data.start = start
  if (end !== undefined) data.end = end
  if (title !== undefined) data.title = title

  return { ok: true, data }
}

function formatIssues(draft: BookingDraft): BookingIssue[] {
  const issues: BookingIssue[] = []

  if (!isValidDate(draft.date)) {
    issues.push(issue('date', 'invalid_date', 'Enter a date as YYYY-MM-DD.'))
  }

  if (!isValidTime(draft.start)) {
    issues.push(issue('start', 'invalid_time', 'Enter a start time as HH:mm.'))
  }

  if (!isValidTime(draft.end)) {
    issues.push(issue('end', 'invalid_time', 'Enter an end time as HH:mm.'))
  }

  return issues
}

function overlaps(start: number, end: number, existing: Booking): boolean {
  const existingStart = timeToMinutes(existing.start)
  const existingEnd = timeToMinutes(existing.end)
  return start < existingEnd && end > existingStart
}

export function validateBooking(
  draft: BookingDraft,
  options: ValidateBookingOptions,
): ValidationResult {
  const formatErrors = formatIssues(draft)
  if (formatErrors.length > 0) {
    return { ok: false, status: 400, issues: formatErrors }
  }

  const issues: BookingIssue[] = []
  const today = formatLocalDate(options.now)
  const start = timeToMinutes(draft.start)
  const end = timeToMinutes(draft.end)
  const nowMinutes = options.now.getHours() * 60 + options.now.getMinutes()

  if (draft.date < today) {
    issues.push(issue('date', 'past_date', 'Bookings on a past date are not allowed.'))
  }

  if (start < DAY_START_MINUTES || start > DAY_END_MINUTES) {
    issues.push(issue('start', 'outside_hours', 'Start must be between 09:00 and 18:00.'))
  }

  if (end < DAY_START_MINUTES || end > DAY_END_MINUTES) {
    issues.push(issue('end', 'outside_hours', 'End must be between 09:00 and 18:00.'))
  }

  if (draft.date === today && start < nowMinutes) {
    issues.push(issue('start', 'past_start', 'Bookings cannot start in the past.'))
  }

  if (start === end) {
    issues.push(issue('end', 'start_not_before_end', 'Start must be earlier than end.'))
  } else if (end < start) {
    issues.push(issue('end', 'end_before_start', 'End must be later than start.'))
  } else {
    const duration = end - start
    if (duration < MIN_DURATION_MINUTES) {
      issues.push(issue('end', 'duration_too_short', 'Booking must be at least 30 minutes.'))
    }
    if (duration > MAX_DURATION_MINUTES) {
      issues.push(issue('end', 'duration_too_long', 'Booking cannot be longer than 120 minutes.'))
    }
  }

  if (issues.length > 0) {
    return { ok: false, status: 422, issues }
  }

  const conflict = options.bookings.some((booking) => {
    if (booking.id === options.ignoreId) {
      return false
    }

    return booking.date === draft.date && overlaps(start, end, booking)
  })

  if (conflict) {
    return {
      ok: false,
      status: 409,
      issues: [issue('form', 'overlap', 'This time overlaps an existing booking.')],
    }
  }

  return { ok: true }
}
