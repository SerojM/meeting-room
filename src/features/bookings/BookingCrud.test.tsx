import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBookingHandlers } from '../../mocks/booking-handlers.ts'
import { server } from '../../mocks/server.ts'
import { BookingDashboard } from './BookingDashboard.tsx'
import { formatTimeRange } from './dates.ts'
import { createBookingRecord, deleteBookingRecord, listBookingsByDate, updateBookingRecord } from './service.ts'
import { writeBookings } from './storage.ts'
import type { Booking } from './types.ts'

const fixedNow = new Date(2026, 5, 15, 8, 0, 0)
const today = '2026-06-15'
const tomorrow = '2026-06-16'
const yesterday = '2026-06-14'

function renderDashboard(now: () => Date = () => fixedNow) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <BookingDashboard now={now} />
    </QueryClientProvider>,
  )
}

function booking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'date' | 'start' | 'end'>): Booking {
  return { ...overrides }
}

function editName(title: string, start: string, end: string): string {
  return `Edit ${title}, ${formatTimeRange(start, end)}`
}

function deleteName(title: string, start: string, end: string): string {
  return `Delete ${title}, ${formatTimeRange(start, end)}`
}

async function openCreate() {
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'New booking' })
  trigger.focus()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: 'New booking' })
  return { user, dialog, trigger }
}

function fill(
  dialog: HTMLElement,
  values: { date?: string; start?: string; end?: string; title?: string },
) {
  const fields = within(dialog)
  if (values.date !== undefined) {
    fireEvent.change(fields.getByLabelText('Date'), { target: { value: values.date } })
  }
  if (values.start !== undefined) {
    fireEvent.change(fields.getByLabelText('Start'), { target: { value: values.start } })
  }
  if (values.end !== undefined) {
    fireEvent.change(fields.getByLabelText('End'), { target: { value: values.end } })
  }
  if (values.title !== undefined) {
    fireEvent.change(fields.getByLabelText(/^Title/), { target: { value: values.title } })
  }
}

describe('booking form', () => {
  beforeEach(() => {
    writeBookings(localStorage, [])
    server.use(...createBookingHandlers({ storage: localStorage, now: () => fixedNow }))
  })

  it('opens the create form for the viewed date and cancels without saving', async () => {
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { user, dialog, trigger } = await openCreate()

    expect(within(dialog).getByLabelText('Date')).toHaveValue(today)
    expect(within(dialog).getByLabelText('Start')).toHaveValue('')
    expect(within(dialog).getByRole('button', { name: 'Save booking' })).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
    expect(screen.getByText('No bookings for this date.')).toBeInTheDocument()
  })

  it('closes the create form with Escape and returns focus', async () => {
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { user, trigger } = await openCreate()
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
  })

  it('creates a booking with an arbitrary minute and shows it on the schedule', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '09:10', end: '09:40', title: 'Planning' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    const list = await screen.findByRole('list', { name: 'Bookings' })
    expect(within(list).getByText('Planning')).toBeInTheDocument()
    expect(within(list).getByText(formatTimeRange('09:10', '09:40'))).toBeInTheDocument()
  })

  it('shows a created booking after moving to its date', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { date: tomorrow, start: '14:00', end: '15:00', title: 'Tomorrow plan' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Date')).toHaveValue(tomorrow)
    expect(await screen.findByText('Tomorrow plan')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByLabelText('Date')).toHaveValue(today)
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
    expect(screen.queryByText('Tomorrow plan')).not.toBeInTheDocument()
  })

  it('rejects a start outside working hours', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '08:00', end: '09:00', title: 'Too early' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(within(dialog).getByLabelText('Start')).toHaveValue('08:00')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Start must be between 09:00 and 18:00.')
    expect(within(dialog).getByLabelText('Start')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Too early')).not.toBeInTheDocument()
  })

  it('rejects a booking shorter than 30 minutes and longer than 120 minutes', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '09:00', end: '09:20' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Booking must be at least 30 minutes.')

    fill(dialog, { start: '09:00', end: '11:30' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Booking cannot be longer than 120 minutes.')
    expect(within(dialog).getByLabelText('End')).toHaveValue('11:30')
  })

  it('rejects a past date and a start that is already past today', async () => {
    const user = userEvent.setup()
    renderDashboard(() => new Date(2026, 5, 15, 11, 0, 0))
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { date: yesterday, start: '10:00', end: '11:00' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bookings on a past date are not allowed.')
    expect(within(dialog).getByLabelText('Date')).toHaveValue(yesterday)

    fill(dialog, { date: today, start: '10:00', end: '11:00' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bookings cannot start in the past.')
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(screen.queryByRole('list', { name: 'Bookings' })).not.toBeInTheDocument()
  })

  it('accepts a booking that starts when another ends', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'first', date: today, start: '10:00', end: '11:00', title: 'First' }),
    ])
    renderDashboard()
    expect(await screen.findByText('First')).toBeInTheDocument()

    const { dialog } = await openCreate()
    fill(dialog, { start: '11:00', end: '12:00', title: 'Follow up' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Follow up')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('rejects an overlapping booking before sending it', async () => {
    const user = userEvent.setup()
    let posts = 0
    server.use(
      http.post('/api/bookings', () => {
        posts += 1
        return HttpResponse.json({ message: 'should not be called' }, { status: 500 })
      }),
    )
    writeBookings(localStorage, [
      booking({ id: 'first', date: today, start: '10:00', end: '11:00', title: 'First' }),
    ])
    renderDashboard()
    expect(await screen.findByText('First')).toBeInTheDocument()

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:30', end: '11:30', title: 'Clash' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(posts).toBe(0)
    expect(within(dialog).getByRole('alert')).toHaveTextContent('This time overlaps an existing booking.')
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:30')
    expect(screen.queryByText('Clash')).not.toBeInTheDocument()
  })

  it('asks the server when the target date could not be loaded', async () => {
    const user = userEvent.setup()
    let posts = 0
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        if (date === tomorrow) {
          return HttpResponse.json({ message: 'Unavailable.' }, { status: 500 })
        }
        const result = listBookingsByDate(localStorage, date, fixedNow)
        return HttpResponse.json(result.ok ? result.bookings : [])
      }),
      http.post('/api/bookings', () => {
        posts += 1
        return HttpResponse.json(
          { message: 'This time overlaps an existing booking.' },
          { status: 409 },
        )
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { date: tomorrow, start: '10:00', end: '11:00', title: 'Unconfirmed' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(posts).toBe(1)
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('This time overlaps an existing booking.')
    expect(alert).toHaveTextContent('The schedule could not be refreshed.')
    expect(alert).toHaveTextContent('Adjust the time and try again.')
    expect(alert).not.toHaveTextContent('The schedule was updated.')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Unconfirmed')
    expect(document.querySelector('#schedule-heading time')).toHaveAttribute('datetime', today)
    expect(screen.queryByText('Unconfirmed')).not.toBeInTheDocument()
  })

  it('edits a booking without treating it as its own conflict', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: editName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit booking' })
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(within(dialog).getByLabelText('End')).toHaveValue('11:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Planning')

    fill(dialog, { title: 'Planning updated' })
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Planning updated')).toBeInTheDocument()
    expect(screen.queryByText('Planning')).not.toBeInTheDocument()
    expect(screen.getByText(formatTimeRange('10:00', '11:00'))).toBeInTheDocument()
  })

  it('rejects an edit that overlaps a different booking', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
      booking({ id: 'design', date: today, start: '13:00', end: '14:00', title: 'Design' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: editName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit booking' })
    fill(dialog, { start: '13:00', end: '14:00' })
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('This time overlaps an existing booking.')
    expect(within(dialog).getByLabelText('Start')).toHaveValue('13:00')
    expect(screen.getByText('Planning')).toBeInTheDocument()
    expect(screen.getByText(formatTimeRange('10:00', '11:00'))).toBeInTheDocument()
    expect(screen.getByText('Design')).toBeInTheDocument()
  })

  it('moves a booking to another date and refreshes both days', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: editName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit booking' })
    fill(dialog, { date: tomorrow })
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Date')).toHaveValue(tomorrow)
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByLabelText('Date')).toHaveValue(today)
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
  })

  it('deletes a booking after confirmation', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: deleteName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete booking?' })
    expect(within(dialog).getByText(/This cannot be undone/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
    expect(screen.queryByText('Planning')).not.toBeInTheDocument()
  })

  it('leaves a booking in place when deletion is cancelled', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    const trigger = await screen.findByRole('button', { name: deleteName('Planning', '10:00', '11:00') })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Delete booking?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
    expect(screen.getByText('Planning')).toBeInTheDocument()
  })

  it('keeps a booking visible when deletion fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.delete('/api/bookings/:id', () => {
        return HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
      }),
    )
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: deleteName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete booking?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete booking' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Storage unavailable.')
    expect(alert).toHaveTextContent('still on the schedule')
    expect(screen.getByText('Planning')).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })

  it('ignores a second save while the first request is in flight', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let posts = 0
    server.use(
      http.post('/api/bookings', async ({ request }) => {
        posts += 1
        const result = createBookingRecord(localStorage, await request.json(), fixedNow, () => 'slow')
        await gate
        if (!result.ok) {
          return HttpResponse.json(
            { message: result.message, errors: 'errors' in result ? result.errors : [] },
            { status: result.status },
          )
        }
        return HttpResponse.json(result.booking, { status: 201 })
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { user, dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Slow' })
    const save = within(dialog).getByRole('button', { name: 'Save booking' })
    void user.click(save)
    await waitFor(() => expect(posts).toBe(1))
    expect(save).toBeDisabled()
    fireEvent.submit(save.closest('form') as HTMLFormElement)
    expect(posts).toBe(1)

    release?.()
    expect(await screen.findByText('Slow')).toBeInTheDocument()
    expect(posts).toBe(1)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('ignores a second delete while the first request is in flight', async () => {
    const user = userEvent.setup()
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let deletes = 0
    server.use(
      http.delete('/api/bookings/:id', async ({ params }) => {
        deletes += 1
        const id = typeof params.id === 'string' ? params.id : ''
        const result = deleteBookingRecord(localStorage, id)
        await gate
        if (!result.ok) {
          return HttpResponse.json({ message: result.message }, { status: result.status })
        }
        return new HttpResponse(null, { status: 204 })
      }),
    )
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: deleteName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete booking?' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete booking' })
    void user.click(confirm)
    await waitFor(() => expect(deletes).toBe(1))
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    expect(deletes).toBe(1)

    release?.()
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
    expect(deletes).toBe(1)
  })

  it('keeps entered values when the server rejects a valid booking', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/bookings', () => {
        return HttpResponse.json(
          {
            message: 'Booking must be at least 30 minutes.',
            errors: [
              {
                field: 'end',
                code: 'duration_too_short',
                message: 'The server rejected this duration.',
              },
            ],
          },
          { status: 422 },
        )
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Still here' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The server rejected this duration.')
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(within(dialog).getByLabelText('End')).toHaveValue('11:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Still here')
    expect(screen.queryByText('Still here')).not.toBeInTheDocument()
  })

  it('keeps the form open when the network fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/bookings', () => {
        return HttpResponse.error()
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Offline' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('network request failed')
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(within(dialog).getByLabelText('End')).toHaveValue('11:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Offline')
    expect(screen.getByText('No bookings for this date.')).toBeInTheDocument()
  })

  it('keeps a conflicting booking form open, refreshes the day, and allows a retry', async () => {
    const user = userEvent.setup()
    let conflicted = false
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        const result = listBookingsByDate(localStorage, date, fixedNow)
        const bookings = result.ok ? [...result.bookings] : []
        if (conflicted && date === today) {
          bookings.push({
            id: 'race',
            date: today,
            start: '10:00',
            end: '11:00',
            title: 'Someone else',
          })
        }
        return HttpResponse.json(bookings)
      }),
      http.post('/api/bookings', async ({ request }) => {
        const body: unknown = await request.json()
        const end = typeof body === 'object' && body !== null && 'end' in body ? body.end : undefined
        if (end === '11:00') {
          conflicted = true
          return HttpResponse.json(
            {
              message: 'This time overlaps an existing booking.',
              errors: [
                {
                  field: 'form',
                  code: 'overlap',
                  message: 'This time overlaps an existing booking.',
                },
              ],
            },
            { status: 409 },
          )
        }

        const result = createBookingRecord(localStorage, body, fixedNow, () => 'created-after-conflict')
        if (!result.ok) {
          return HttpResponse.json(
            { message: result.message, errors: 'errors' in result ? result.errors : [] },
            { status: result.status },
          )
        }
        return HttpResponse.json(result.booking, { status: 201 })
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Mine' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('This time overlaps an existing booking.')
    expect(alert).toHaveTextContent('The schedule was updated.')
    expect(alert).toHaveTextContent('Adjust the time and try again.')
    expect(within(dialog).getByLabelText('Date')).toHaveValue(today)
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(within(dialog).getByLabelText('End')).toHaveValue('11:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Mine')
    expect(await screen.findByText('Someone else')).toBeInTheDocument()
    expect(screen.queryByText('Mine')).not.toBeInTheDocument()

    fill(dialog, { start: '11:00', end: '12:00' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Mine')).toBeInTheDocument()
    expect(screen.getByText('Someone else')).toBeInTheDocument()
    expect(screen.getByText(formatTimeRange('11:00', '12:00'))).toBeInTheDocument()
  })

  it('refreshes a conflicting date that is not currently displayed', async () => {
    const user = userEvent.setup()
    let tomorrowReads = 0
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        if (date === tomorrow) tomorrowReads += 1
        const result = listBookingsByDate(localStorage, date, fixedNow)
        return HttpResponse.json(result.ok ? result.bookings : [])
      }),
      http.post('/api/bookings', () => {
        return HttpResponse.json(
          { message: 'This time overlaps an existing booking.' },
          { status: 409 },
        )
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { date: tomorrow, start: '15:00', end: '16:00', title: 'Later' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('The schedule was updated.')
    expect(alert).toHaveTextContent('Adjust the time and try again.')
    await waitFor(() => expect(tomorrowReads).toBeGreaterThanOrEqual(2))
    expect(within(dialog).getByLabelText('Date')).toHaveValue(tomorrow)
    expect(within(dialog).getByLabelText('Start')).toHaveValue('15:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Later')
    expect(document.querySelector('#schedule-heading time')).toHaveAttribute('datetime', today)
  })

  it('closes the form after a saved booking when the schedule refresh fails', async () => {
    const user = userEvent.setup()
    let saved = false
    let posts = 0
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        if (saved && date === today) {
          return HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
        }
        const result = listBookingsByDate(localStorage, date, fixedNow)
        return HttpResponse.json(result.ok ? result.bookings : [])
      }),
      http.post('/api/bookings', async ({ request }) => {
        posts += 1
        const result = createBookingRecord(localStorage, await request.json(), fixedNow, () => 'saved-id')
        if (!result.ok) {
          return HttpResponse.json(
            { message: result.message, errors: 'errors' in result ? result.errors : [] },
            { status: result.status },
          )
        }
        saved = true
        return HttpResponse.json(result.booking, { status: 201 })
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Kept' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(posts).toBe(1)
    expect(screen.getByText('Kept')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Bookings could not be loaded.')
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument()
  })

  it('closes the form after a saved edit when the schedule refresh fails', async () => {
    const user = userEvent.setup()
    let saved = false
    let patches = 0
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        if (saved && date === today) {
          return HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
        }
        const result = listBookingsByDate(localStorage, date, fixedNow)
        return HttpResponse.json(result.ok ? result.bookings : [])
      }),
      http.patch('/api/bookings/:id', async ({ params, request }) => {
        patches += 1
        const id = typeof params.id === 'string' ? params.id : ''
        const result = updateBookingRecord(localStorage, id, await request.json(), fixedNow)
        if (!result.ok) {
          return HttpResponse.json(
            { message: result.message, errors: 'errors' in result ? result.errors : [] },
            { status: result.status },
          )
        }
        saved = true
        return HttpResponse.json(result.booking)
      }),
    )
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: editName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit booking' })
    fill(dialog, { title: 'Planning kept' })
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(patches).toBe(1)
    expect(screen.getByText('Planning kept')).toBeInTheDocument()
    expect(screen.queryByText('Planning', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Bookings could not be loaded.')
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument()
  })

  it('keeps every conflict value and does not claim a failed refresh succeeded', async () => {
    const user = userEvent.setup()
    let conflicted = false
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        if (conflicted && date === today) {
          return HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
        }
        const result = listBookingsByDate(localStorage, date, fixedNow)
        return HttpResponse.json(result.ok ? result.bookings : [])
      }),
      http.post('/api/bookings', () => {
        conflicted = true
        return HttpResponse.json({ message: 'This time overlaps an existing booking.' }, { status: 409 })
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Mine' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('This time overlaps an existing booking.')
    expect(alert).toHaveTextContent('The schedule could not be refreshed.')
    expect(alert).toHaveTextContent('Adjust the time and try again.')
    expect(alert).not.toHaveTextContent('The schedule was updated.')
    expect(within(dialog).getByLabelText('Date')).toHaveValue(today)
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(within(dialog).getByLabelText('End')).toHaveValue('11:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Mine')
    expect(screen.queryByText('Mine')).not.toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })

  it('replaces server validation errors when corrected fields are submitted again', async () => {
    const user = userEvent.setup()
    let attempt = 0
    server.use(
      http.post('/api/bookings', () => {
        attempt += 1
        if (attempt === 1) {
          return HttpResponse.json(
            {
              message: 'Check the booking.',
              errors: [
                { field: 'title', code: 'title_rejected', message: 'The server rejected this title.' },
                { field: 'end', code: 'end_rejected', message: 'The server rejected this end time.' },
              ],
            },
            { status: 422 },
          )
        }
        return HttpResponse.json(
          {
            message: 'Check the booking.',
            errors: [{ field: 'start', code: 'start_rejected', message: 'The server rejected this start time.' }],
          },
          { status: 422 },
        )
      }),
    )
    renderDashboard()
    await screen.findByText('No bookings for this date.')

    const { dialog } = await openCreate()
    fill(dialog, { start: '10:00', end: '11:00', title: 'Budget' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(await within(dialog).findByText('The server rejected this title.')).toBeInTheDocument()
    expect(within(dialog).getByText('The server rejected this end time.')).toBeInTheDocument()

    fill(dialog, { end: '12:00', title: 'Planning' })
    await user.click(within(dialog).getByRole('button', { name: 'Save booking' }))

    expect(await within(dialog).findByText('The server rejected this start time.')).toBeInTheDocument()
    expect(within(dialog).queryByText('The server rejected this title.')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('The server rejected this end time.')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00')
    expect(within(dialog).getByLabelText('End')).toHaveValue('12:00')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Planning')
    expect(attempt).toBe(2)
    expect(dialog).toBeInTheDocument()
  })

  it('closes the delete dialog when deletion succeeds and the refresh fails', async () => {
    const user = userEvent.setup()
    let deleted = false
    let deletes = 0
    server.use(
      http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        if (deleted && date === today) {
          return HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
        }
        const result = listBookingsByDate(localStorage, date, fixedNow)
        return HttpResponse.json(result.ok ? result.bookings : [])
      }),
      http.delete('/api/bookings/:id', ({ params }) => {
        deletes += 1
        const id = typeof params.id === 'string' ? params.id : ''
        const result = deleteBookingRecord(localStorage, id)
        if (!result.ok) {
          return HttpResponse.json({ message: result.message }, { status: result.status })
        }
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    writeBookings(localStorage, [
      booking({ id: 'plan', date: today, start: '10:00', end: '11:00', title: 'Planning' }),
    ])
    renderDashboard()
    expect(await screen.findByText('Planning')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: deleteName('Planning', '10:00', '11:00') }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete booking?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete booking' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(deletes).toBe(1)
    expect(screen.queryByText('Planning')).not.toBeInTheDocument()
    expect(screen.queryByText(/still on the schedule/)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Bookings could not be loaded.')
  })
})
