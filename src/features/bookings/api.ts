import type { Booking, BookingIssue, CreateBookingInput, UpdateBookingInput } from './types.ts'

export type ApiErrorKind = 'validation' | 'conflict' | 'server' | 'network'

export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  readonly issues: BookingIssue[]

  constructor(message: string, status: number, kind: ApiErrorKind, issues: BookingIssue[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
    this.issues = issues
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function readIssue(value: unknown): BookingIssue | null {
  if (!isRecord(value)) {
    return null
  }

  const { field, code, message } = value
  if (
    (field === 'date' || field === 'start' || field === 'end' || field === 'title' || field === 'form') &&
    typeof code === 'string' &&
    typeof message === 'string'
  ) {
    return { field, code, message }
  }

  return null
}

function isBooking(value: unknown): value is Booking {
  if (!isRecord(value)) {
    return false
  }

  if (typeof value.id !== 'string' || value.id.length === 0) {
    return false
  }
  if (typeof value.date !== 'string' || typeof value.start !== 'string' || typeof value.end !== 'string') {
    return false
  }
  if (value.title !== undefined && typeof value.title !== 'string') {
    return false
  }

  return true
}

function toBooking(value: Booking): Booking {
  const booking: Booking = {
    id: value.id,
    date: value.date,
    start: value.start,
    end: value.end,
  }

  if (value.title !== undefined) {
    booking.title = value.title
  }

  return booking
}

function errorKind(status: number): ApiErrorKind {
  if (status === 409) return 'conflict'
  if (status === 400 || status === 422) return 'validation'
  return 'server'
}

async function readError(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  const record = isRecord(body) ? body : null
  const message = record && typeof record.message === 'string' ? record.message : 'Request failed.'
  const issues =
    record && Array.isArray(record.errors)
      ? record.errors.flatMap((item) => {
          const issue = readIssue(item)
          return issue ? [issue] : []
        })
      : []

  return new ApiError(message, response.status, errorKind(response.status), issues)
}

async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }

    throw new ApiError('Network request failed.', 0, 'network')
  }
}

export async function getBookings(date: string, signal?: AbortSignal): Promise<Booking[]> {
  const params = new URLSearchParams({ date })
  const response = await request(`/api/bookings?${params}`, { signal })

  if (!response.ok) {
    throw await readError(response)
  }

  const body: unknown = await response.json()
  if (!Array.isArray(body) || !body.every(isBooking)) {
    throw new ApiError('Response was not a booking list.', response.status, 'server')
  }

  return body.map(toBooking)
}

export async function createBooking(
  payload: CreateBookingInput,
  signal?: AbortSignal,
): Promise<Booking> {
  const response = await request('/api/bookings', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await readError(response)
  }

  const body: unknown = await response.json()
  if (!isBooking(body)) {
    throw new ApiError('Response was not a booking.', response.status, 'server')
  }

  return toBooking(body)
}

export async function updateBooking(
  id: string,
  payload: UpdateBookingInput,
  signal?: AbortSignal,
): Promise<Booking> {
  const response = await request(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await readError(response)
  }

  const body: unknown = await response.json()
  if (!isBooking(body)) {
    throw new ApiError('Response was not a booking.', response.status, 'server')
  }

  return toBooking(body)
}

export async function deleteBooking(id: string, signal?: AbortSignal): Promise<void> {
  const response = await request(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  })

  if (response.status === 204) {
    return
  }

  if (!response.ok) {
    throw await readError(response)
  }
}
