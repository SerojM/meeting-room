import { Pencil, Trash2 } from 'lucide-react'
import type { Booking } from './types.ts'
import { DAY_END_MINUTES, DAY_START_MINUTES, timeToMinutes } from './time.ts'
import { formatTimeRange } from './dates.ts'

const HOUR_HEIGHT = 96
const DAY_SPAN = DAY_END_MINUTES - DAY_START_MINUTES
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function bookingTitle(booking: Booking): string {
  if (booking.title && booking.title.trim().length > 0) {
    return booking.title
  }

  return 'Untitled booking'
}

const actionClassName =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-teal-900 hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800'

type DayTimelineProps = {
  bookings: Booking[]
  onEdit: (booking: Booking, trigger: HTMLButtonElement) => void
  onDelete: (booking: Booking, trigger: HTMLButtonElement) => void
}

export function DayTimeline({ bookings, onEdit, onDelete }: DayTimelineProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)]" style={{ height: (DAY_SPAN / 60) * HOUR_HEIGHT }}>
        <div aria-hidden="true" className="relative border-r border-stone-200 bg-stone-50">
          {HOURS.map((hour, index) => (
            <span
              key={hour}
              className={`absolute right-2 text-xs tabular-nums text-stone-600 ${index === HOURS.length - 1 ? '-translate-y-full' : ''}`}
              style={{ top: `${(index / (HOURS.length - 1)) * 100}%` }}
            >
              {hourLabel(hour)}
            </span>
          ))}
        </div>

        <div className="relative">
          <div aria-hidden="true" className="absolute inset-0">
            {HOURS.slice(1, -1).map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-stone-100"
                style={{ top: `${((hour * 60 - DAY_START_MINUTES) / DAY_SPAN) * 100}%` }}
              />
            ))}
          </div>

          {bookings.length === 0 ? (
            <p role="status" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-stone-600">
              No bookings for this date.
            </p>
          ) : (
            <ol aria-label="Bookings" className="absolute inset-0">
              {bookings.map((booking) => {
                const start = timeToMinutes(booking.start)
                const end = timeToMinutes(booking.end)
                if (Number.isNaN(start) || Number.isNaN(end)) {
                  return null
                }

                const title = bookingTitle(booking)
                const range = formatTimeRange(booking.start, booking.end)

                return (
                  <li
                    key={booking.id}
                    className="absolute right-2 left-2 flex items-center gap-2 overflow-hidden rounded-md border-y border-r border-teal-200 border-l-4 border-l-teal-800 bg-teal-50 px-3 py-1"
                    style={{
                      top: `${((start - DAY_START_MINUTES) / DAY_SPAN) * 100}%`,
                      height: `${((end - start) / DAY_SPAN) * 100}%`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-tight font-medium text-teal-950">{title}</p>
                      <p className="truncate text-xs leading-tight tabular-nums text-teal-900">{range}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className={actionClassName}
                        aria-label={`Edit ${title}, ${range}`}
                        onClick={(event) => onEdit(booking, event.currentTarget)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={actionClassName}
                        aria-label={`Delete ${title}, ${range}`}
                        onClick={(event) => onDelete(booking, event.currentTarget)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
