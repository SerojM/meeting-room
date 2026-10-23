import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isValidDate } from './time.ts'
import { shiftLocalDate } from './dates.ts'

const controlClassName =
  'inline-flex h-10 items-center justify-center gap-1 px-3 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:text-stone-400'

type DateControlsProps = {
  date: string
  today: string
  onDateChange: (date: string) => void
}

export function DateControls({ date, today, onDateChange }: DateControlsProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="inline-flex w-fit overflow-hidden rounded-md border border-stone-300 bg-white">
        <button
          type="button"
          className={controlClassName}
          aria-label="Previous day"
          onClick={() => onDateChange(shiftLocalDate(date, -1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${controlClassName} border-x border-stone-300`}
          onClick={() => onDateChange(today)}
        >
          Today
        </button>
        <button
          type="button"
          className={controlClassName}
          aria-label="Next day"
          onClick={() => onDateChange(shiftLocalDate(date, 1))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="booking-date" className="text-sm font-medium text-stone-700">
          Date
        </label>
        <input
          id="booking-date"
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value
            if (isValidDate(nextDate)) {
              onDateChange(nextDate)
            }
          }}
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        />
      </div>
    </div>
  )
}
