import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, deleteBooking } from './api.ts'
import { formatTimeRange } from './dates.ts'
import type { Booking } from './types.ts'
import { cacheDeletedBooking, refreshBookingDates } from './useBookings.ts'
import { useModalDialog } from './useModalDialog.ts'

const secondaryButtonClassName =
  'inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'

const dangerButtonClassName =
  'inline-flex h-10 w-full items-center justify-center rounded-md bg-rose-800 px-4 text-sm font-medium text-white hover:bg-rose-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'

function bookingLabel(booking: Booking): string {
  const title = booking.title?.trim()
  return title && title.length > 0 ? title : 'Untitled booking'
}

export function DeleteBookingDialog({
  booking,
  onClose,
  onDeleted,
}: {
  booking: Booking
  onClose: () => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useModalDialog(onClose, () => inFlight.current)

  const mutation = useMutation({
    retry: false,
    mutationFn: () => deleteBooking(booking.id),
    onSuccess: async () => {
      cacheDeletedBooking(queryClient, booking)
      await refreshBookingDates(queryClient, [booking.date])
      onDeleted()
    },
    onError: (caught) => {
      const detail = caught instanceof ApiError && caught.message.length > 0 ? caught.message : 'The booking could not be deleted.'
      setError(`${detail} It is still on the schedule. Try again.`)
    },
  })

  const title = bookingLabel(booking)
  const range = formatTimeRange(booking.start, booking.end)

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-booking-heading"
      aria-describedby="delete-booking-description"
      aria-modal="true"
      className="m-auto w-[min(100%-2rem,28rem)] rounded-lg border border-stone-200 bg-white p-0 text-stone-900 shadow-xl open:block backdrop:bg-stone-950/40"
    >
      <div className="flex flex-col gap-4 p-5" aria-busy={mutation.isPending}>
        <div>
          <h2
            id="delete-booking-heading"
            data-dialog-title=""
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Delete booking?
          </h2>
          <p id="delete-booking-description" className="mt-1 text-sm text-stone-600">
            Delete {title}, {range}? This cannot be undone.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButtonClassName} disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={dangerButtonClassName}
            disabled={mutation.isPending}
            onClick={() => {
              if (inFlight.current || mutation.isPending) return
              inFlight.current = true
              mutation.mutate(undefined, {
                onSettled: () => {
                  inFlight.current = false
                },
              })
            }}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete booking'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
