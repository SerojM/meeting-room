import type { QueryClient } from '@tanstack/react-query'
import type { FieldError, FieldErrors, Resolver } from 'react-hook-form'
import { z } from 'zod'
import { getBookings } from './api.ts'
import type { Booking, CreateBookingInput } from './types.ts'
import { isValidDate } from './time.ts'
import { bookingsQueryKey } from './useBookings.ts'
import { validateBooking, type BookingDraft } from './validation.ts'

const bookingFormSchema = z.object({
  date: z.string(),
  start: z.string(),
  end: z.string(),
  title: z.string(),
})

export type BookingFormValues = z.infer<typeof bookingFormSchema>

export function valuesFromBooking(booking: Booking): BookingFormValues {
  return {
    date: booking.date,
    start: booking.start,
    end: booking.end,
    title: booking.title ?? '',
  }
}

export function toDraft(values: BookingFormValues): BookingDraft {
  const draft: BookingDraft = {
    date: values.date,
    start: values.start,
    end: values.end,
  }
  const title = values.title.trim()
  if (title.length > 0) {
    draft.title = title
  }
  return draft
}

export function toMutationInput(values: BookingFormValues): CreateBookingInput {
  return {
    date: values.date,
    start: values.start,
    end: values.end,
    title: values.title.trim(),
  }
}

function emptyValues(): BookingFormValues {
  return { date: '', start: '', end: '', title: '' }
}

export function createBookingValues(date: string): BookingFormValues {
  return { ...emptyValues(), date }
}

function fieldError(code: string, message: string): FieldError {
  return { type: code, message }
}

function issuesToErrors(
  issues: { path: PropertyKey[]; code: string; message: string }[],
): FieldErrors<BookingFormValues> {
  const errors: FieldErrors<BookingFormValues> = {}

  for (const item of issues) {
    const key = item.path[0]
    const error = fieldError(item.code, item.message)
    if (key === 'date' && !errors.date) errors.date = error
    else if (key === 'start' && !errors.start) errors.start = error
    else if (key === 'end' && !errors.end) errors.end = error
    else if (key === 'title' && !errors.title) errors.title = error
    else if (!errors.root) errors.root = error
  }

  return errors
}

export function createBookingResolver(options: {
  now: () => Date
  ignoreId?: string
  queryClient: QueryClient
}): Resolver<BookingFormValues> {
  return async (values) => {
    let bookings: Booking[] = []
    let checkOverlap = false

    if (isValidDate(values.date)) {
      try {
        bookings = await options.queryClient.fetchQuery({
          queryKey: bookingsQueryKey(values.date),
          queryFn: ({ signal }) => getBookings(values.date, signal),
        })
        checkOverlap = true
      } catch {
        checkOverlap = false
      }
    }

    const schema = bookingFormSchema.superRefine((input, ctx) => {
      const result = validateBooking(toDraft(input), {
        now: options.now(),
        bookings: checkOverlap ? bookings : [],
        ignoreId: options.ignoreId,
      })

      if (result.ok) return

      for (const item of result.issues) {
        if (!checkOverlap && item.code === 'overlap') continue
        ctx.addIssue({
          code: 'custom',
          message: item.message,
          path: item.field === 'form' ? ['root'] : [item.field],
        })
      }
    })

    const parsed = await schema.safeParseAsync(values)
    if (parsed.success) {
      return { values: parsed.data, errors: {} }
    }

    return {
      values: {},
      errors: issuesToErrors(parsed.error.issues),
    }
  }
}
