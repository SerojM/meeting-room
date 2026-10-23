import { Clock, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BookingFormDialog } from './BookingFormDialog.tsx'
import { createBookingValues, valuesFromBooking, type BookingFormValues } from './bookingForm.ts'
import { DateControls } from './DateControls.tsx'
import { DayTimeline } from './DayTimeline.tsx'
import { DeleteBookingDialog } from './DeleteBookingDialog.tsx'
import { formatLongDate } from './dates.ts'
import { formatLocalDate } from './time.ts'
import type { Booking } from './types.ts'
import { useBookings } from './useBookings.ts'

const ROOM_NAME = 'North Room'

function currentDate() {
  return new Date()
}

function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return 'Bookings could not be loaded.'
}

type EditorState = {
  mode: 'create' | 'edit'
  values: BookingFormValues
  bookingId?: string
  originalDate?: string
}

type DeleteState = {
  booking: Booking
}

export function BookingDashboard({ now = currentDate }: { now?: () => Date }) {
  const [date, setDate] = useState(() => formatLocalDate(now()))
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteState | null>(null)
  const newBookingRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const query = useBookings(date)
  const isLoading = query.isPending || (query.isFetching && query.data === undefined)
  const dialogOpen = editor !== null || pendingDelete !== null

  useEffect(() => {
    if (dialogOpen) return
    const target = restoreFocus.current
    if (!target) return
    restoreFocus.current = null
    if (target.isConnected) {
      target.focus()
    } else {
      newBookingRef.current?.focus()
    }
  }, [dialogOpen])

  function openCreate(trigger: HTMLElement) {
    restoreFocus.current = trigger
    setEditor({ mode: 'create', values: createBookingValues(date) })
  }

  function openEdit(booking: Booking, trigger: HTMLElement) {
    restoreFocus.current = trigger
    setEditor({
      mode: 'edit',
      values: valuesFromBooking(booking),
      bookingId: booking.id,
      originalDate: booking.date,
    })
  }

  function openDelete(booking: Booking, trigger: HTMLElement) {
    restoreFocus.current = trigger
    setPendingDelete({ booking })
  }

  function closeEditor() {
    setEditor(null)
  }

  function handleSaved(booking: Booking) {
    if (booking.date !== date) {
      setDate(booking.date)
    }
    setEditor(null)
  }

  return (
    <div className="min-h-svh bg-stone-100 text-stone-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-stone-500">Meeting rooms</p>
            <h1 className="text-3xl font-semibold tracking-tight">{ROOM_NAME}</h1>
            <p className="flex items-center gap-2 text-sm text-stone-600">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Working hours <time>09:00–18:00</time>
              </span>
            </p>
          </div>
          <button
            ref={newBookingRef}
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            onClick={(event) => openCreate(event.currentTarget)}
          >
            <Plus className="size-4" aria-hidden="true" />
            New booking
          </button>
        </header>

        <DateControls date={date} today={formatLocalDate(now())} onDateChange={setDate} />

        <section className="space-y-4" aria-labelledby="schedule-heading" aria-busy={isLoading}>
          <h2 id="schedule-heading" className="text-lg font-semibold tracking-tight">
            <time dateTime={date}>{formatLongDate(date)}</time>
          </h2>

          {isLoading ? (
            <p role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-sm text-stone-600">
              Loading bookings…
            </p>
          ) : null}

          {!isLoading && query.isError ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="font-medium text-rose-950">Bookings could not be loaded.</p>
              <p className="mt-1 text-sm text-rose-900">{errorDetail(query.error)}</p>
              <button
                type="button"
                className="mt-3 inline-flex h-9 items-center rounded-md border border-rose-300 bg-white px-3 text-sm font-medium text-rose-950 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800"
                onClick={() => {
                  void query.refetch()
                }}
              >
                Try again
              </button>
            </div>
          ) : null}

          {!isLoading && query.data ? (
            <DayTimeline bookings={query.data} onEdit={openEdit} onDelete={openDelete} />
          ) : null}
        </section>
      </div>

      {editor ? (
        <BookingFormDialog
          mode={editor.mode}
          initialValues={editor.values}
          bookingId={editor.bookingId}
          originalDate={editor.originalDate}
          now={now}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteBookingDialog
          booking={pendingDelete.booking}
          onClose={() => setPendingDelete(null)}
          onDeleted={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  )
}
