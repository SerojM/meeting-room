import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, createBooking, updateBooking } from './api.ts'
import {
  createBookingResolver,
  toMutationInput,
  type BookingFormValues,
} from './bookingForm.ts'
import type { Booking } from './types.ts'
import { cacheSavedBooking, refreshBookingDates } from './useBookings.ts'
import { useModalDialog } from './useModalDialog.ts'

const inputClassName =
  'h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:bg-stone-50 aria-invalid:border-rose-400'

const secondaryButtonClassName =
  'inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'

const primaryButtonClassName =
  'inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'

type BookingFormDialogProps = {
  mode: 'create' | 'edit'
  initialValues: BookingFormValues
  bookingId?: string
  originalDate?: string
  now: () => Date
  onClose: () => void
  onSaved: (booking: Booking) => void
}

function FormField({
  id,
  label,
  hint,
  type,
  step,
  error,
  disabled,
  registration,
}: {
  id: string
  label: string
  hint?: string
  type: 'date' | 'time' | 'text'
  step?: number
  error?: string
  disabled: boolean
  registration: UseFormRegisterReturn
}) {
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
        {hint ? <span className="font-normal text-stone-500"> {hint}</span> : null}
      </label>
      <input
        id={id}
        type={type}
        step={step}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClassName}
        {...registration}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
      {children}
    </p>
  )
}

export function BookingFormDialog({
  mode,
  initialValues,
  bookingId,
  originalDate,
  now,
  onClose,
  onSaved,
}: BookingFormDialogProps) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const dialogRef = useModalDialog(onClose, () => inFlight.current)

  const form = useForm<BookingFormValues>({
    defaultValues: initialValues,
    resolver: createBookingResolver({ now, ignoreId: bookingId, queryClient }),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const mutation = useMutation({
    retry: false,
    mutationFn: (values: BookingFormValues) => {
      const payload = toMutationInput(values)
      if (mode === 'edit' && bookingId) {
        return updateBooking(bookingId, payload)
      }
      return createBooking(payload)
    },
    onSuccess: async (booking) => {
      cacheSavedBooking(queryClient, booking, originalDate)
      const dates = [booking.date]
      if (originalDate) dates.push(originalDate)
      await refreshBookingDates(queryClient, dates)
      onSaved(booking)
    },
    onError: async (error, values) => {
      if (error instanceof ApiError && error.kind === 'conflict') {
        const detail = error.message.trim() || 'This time overlaps an existing booking.'
        const refreshed = await refreshBookingDates(queryClient, [values.date])
        setConflict(
          refreshed
            ? `${detail} The schedule was updated. Adjust the time and try again.`
            : `${detail} The schedule could not be refreshed. Adjust the time and try again.`,
        )
        return
      }

      if (error instanceof ApiError && error.kind === 'validation') {
        let placed = false
        for (const item of error.issues) {
          if (item.field === 'date' || item.field === 'start' || item.field === 'end' || item.field === 'title') {
            form.setError(item.field, { type: item.code, message: item.message })
            placed = true
          } else if (item.field === 'form') {
            form.setError('root', { type: item.code, message: item.message })
            placed = true
          }
        }
        if (!placed) {
          setRequestError(error.message || 'The booking could not be saved. Check the fields and try again.')
        }
        return
      }

      if (error instanceof ApiError && error.kind === 'network') {
        setRequestError('The booking could not be saved because the network request failed. Try again.')
        return
      }

      const message = error instanceof Error && error.message.length > 0 ? error.message : 'The booking could not be saved.'
      setRequestError(`${message} Try again.`)
    },
  })

  const pending = form.formState.isSubmitting || mutation.isPending

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values)
  })

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setConflict(null)
    setRequestError(null)
    try {
      await submit(event)
    } catch {
      // The mutation error is shown from onError. Keep the entered values.
    } finally {
      inFlight.current = false
    }
  }

  const heading = mode === 'create' ? 'New booking' : 'Edit booking'
  const saveLabel = pending ? 'Saving…' : mode === 'create' ? 'Save booking' : 'Save changes'
  const rootMessage = form.formState.errors.root?.message

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="booking-form-heading"
      aria-modal="true"
      className="m-auto w-[min(100%-2rem,28rem)] rounded-lg border border-stone-200 bg-white p-0 text-stone-900 shadow-xl open:block backdrop:bg-stone-950/40"
    >
      <form className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-y-auto p-5" aria-busy={pending} onSubmit={onSubmit}>
        <div>
          <h2
            id="booking-form-heading"
            data-dialog-title=""
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            {heading}
          </h2>
          <p className="mt-1 text-sm text-stone-600">Working hours are 09:00–18:00. A booking can last 30 to 120 minutes.</p>
        </div>

        {conflict ? (
          <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {conflict}
          </p>
        ) : null}
        {requestError ? <Alert>{requestError}</Alert> : null}
        {rootMessage ? <Alert>{rootMessage}</Alert> : null}

        <FormField
          id="booking-form-date"
          label="Date"
          type="date"
          error={form.formState.errors.date?.message}
          disabled={pending}
          registration={form.register('date')}
        />
        <FormField
          id="booking-form-start"
          label="Start"
          type="time"
          step={60}
          error={form.formState.errors.start?.message}
          disabled={pending}
          registration={form.register('start')}
        />
        <FormField
          id="booking-form-end"
          label="End"
          type="time"
          step={60}
          error={form.formState.errors.end?.message}
          disabled={pending}
          registration={form.register('end')}
        />
        <FormField
          id="booking-form-title"
          label="Title"
          hint="(optional)"
          type="text"
          error={form.formState.errors.title?.message}
          disabled={pending}
          registration={form.register('title')}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClassName} disabled={pending}>
            {saveLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
