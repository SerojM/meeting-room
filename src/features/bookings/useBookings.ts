import { useQuery, type QueryClient } from '@tanstack/react-query'
import { getBookings } from './api.ts'
import type { Booking } from './types.ts'

export function bookingsQueryKey(date: string) {
  return ['bookings', date] as const
}

export function useBookings(date: string) {
  return useQuery({
    queryKey: bookingsQueryKey(date),
    queryFn: ({ signal }) => getBookings(date, signal),
  })
}

function byStart(a: Booking, b: Booking): number {
  if (a.start < b.start) return -1
  if (a.start > b.start) return 1
  if (a.end < b.end) return -1
  if (a.end > b.end) return 1
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

export function cacheSavedBooking(queryClient: QueryClient, booking: Booking, previousDate?: string) {
  queryClient.setQueryData<Booking[]>(bookingsQueryKey(booking.date), (current) => {
    const next = (current ?? []).filter((item) => item.id !== booking.id)
    next.push(booking)
    next.sort(byStart)
    return next
  })

  if (previousDate && previousDate !== booking.date) {
    queryClient.setQueryData<Booking[]>(bookingsQueryKey(previousDate), (current) =>
      current?.filter((item) => item.id !== booking.id),
    )
  }
}

export function cacheDeletedBooking(queryClient: QueryClient, booking: Booking) {
  queryClient.setQueryData<Booking[]>(bookingsQueryKey(booking.date), (current) =>
    current?.filter((item) => item.id !== booking.id),
  )
}

export async function refreshBookingDates(queryClient: QueryClient, dates: Iterable<string>): Promise<boolean> {
  const unique = [...new Set(dates)]

  try {
    await Promise.all(
      unique.map((day) =>
        queryClient.invalidateQueries(
          { queryKey: bookingsQueryKey(day), refetchType: 'all' },
          { throwOnError: true },
        ),
      ),
    )
    return true
  } catch {
    return false
  }
}
