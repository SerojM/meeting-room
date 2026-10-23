import { http, HttpResponse, type AnyHandler } from 'msw'
import {
  createBookingRecord,
  deleteBookingRecord,
  listBookingsByDate,
  updateBookingRecord,
  type DeleteBookingResult,
  type ListBookingsResult,
  type SaveBookingResult,
} from '../features/bookings/service.ts'
import type { BookingStorage } from '../features/bookings/storage.ts'

type BookingHandlerOptions = {
  storage?: BookingStorage
  now?: () => Date
  createId?: () => string
}

function errorResponse(result: Exclude<ListBookingsResult | SaveBookingResult | DeleteBookingResult, { ok: true }>) {
  if (result.status === 404) {
    return HttpResponse.json({ message: result.message }, { status: 404 })
  }

  return HttpResponse.json(
    { message: result.message, errors: result.errors },
    { status: result.status },
  )
}

async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function invalidJsonResponse() {
  return HttpResponse.json(
    {
      message: 'Request body must be JSON.',
      errors: [{ field: 'form', code: 'invalid_json', message: 'Request body must be JSON.' }],
    },
    { status: 400 },
  )
}

export function createBookingHandlers(options: BookingHandlerOptions = {}): AnyHandler[] {
  const storage = options.storage ?? localStorage
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())

  return [
    http.get('/api/bookings', ({ request }) => {
      const date = new URL(request.url).searchParams.get('date')
      const result = listBookingsByDate(storage, date, now())
      if (!result.ok) {
        return errorResponse(result)
      }

      return HttpResponse.json(result.bookings)
    }),

    http.post('/api/bookings', async ({ request }) => {
      const body = await readJson(request)
      if (body === undefined) {
        return invalidJsonResponse()
      }

      const result = createBookingRecord(storage, body, now(), createId)
      if (!result.ok) {
        return errorResponse(result)
      }

      return HttpResponse.json(result.booking, { status: 201 })
    }),

    http.patch('/api/bookings/:id', async ({ params, request }) => {
      const body = await readJson(request)
      if (body === undefined) {
        return invalidJsonResponse()
      }

      const id = typeof params.id === 'string' ? params.id : ''
      const result = updateBookingRecord(storage, id, body, now())
      if (!result.ok) {
        return errorResponse(result)
      }

      return HttpResponse.json(result.booking)
    }),

    http.delete('/api/bookings/:id', ({ params }) => {
      const id = typeof params.id === 'string' ? params.id : ''
      const result = deleteBookingRecord(storage, id, now())
      if (!result.ok) {
        return errorResponse(result)
      }

      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
