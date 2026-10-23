import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../mocks/server.ts'
import { formatTimeRange } from './dates.ts'
import { BookingDashboard } from './BookingDashboard.tsx'
import { writeBookings } from './storage.ts'
import { addLocalDays, formatLocalDate } from './time.ts'
import type { Booking } from './types.ts'

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <BookingDashboard />
    </QueryClientProvider>,
  )
}

function booking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'date' | 'start' | 'end'>): Booking {
  return { ...overrides }
}

describe('BookingDashboard', () => {
  const today = formatLocalDate(new Date())
  const yesterday = formatLocalDate(addLocalDays(new Date(), -1))
  const tomorrow = formatLocalDate(addLocalDays(new Date(), 1))

  beforeEach(() => {
    writeBookings(localStorage, [])
  })

  it('shows the room, working hours, and an empty day', async () => {
    renderDashboard()

    expect(screen.getByRole('heading', { name: 'North Room' })).toBeInTheDocument()
    expect(screen.getByText('09:00–18:00')).toBeInTheDocument()
    expect(screen.getByLabelText('Date')).toHaveValue(today)
    expect(screen.getByRole('button', { name: 'New booking' })).toBeEnabled()
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
  })

  it('shows bookings for the selected date, including off-grid times', async () => {
    writeBookings(localStorage, [
      booking({
        id: 'odd',
        date: today,
        start: '09:10',
        end: '09:40',
        title: 'Odd slot',
      }),
      booking({
        id: 'later',
        date: today,
        start: '15:00',
        end: '16:00',
        title: 'Design review',
      }),
      booking({
        id: 'other',
        date: tomorrow,
        start: '11:00',
        end: '12:00',
        title: 'Tomorrow only',
      }),
    ])

    renderDashboard()

    const list = await screen.findByRole('list', { name: 'Bookings' })
    expect(within(list).getByText('Odd slot')).toBeInTheDocument()
    expect(within(list).getByText(formatTimeRange('09:10', '09:40'))).toBeInTheDocument()
    expect(within(list).getByText('Design review')).toBeInTheDocument()
    expect(within(list).queryByText('Tomorrow only')).not.toBeInTheDocument()
  })

  it('moves between days and can return to today', async () => {
    const user = userEvent.setup()
    writeBookings(localStorage, [
      booking({ id: 'today', date: today, start: '10:00', end: '11:00', title: 'Today meeting' }),
      booking({
        id: 'yesterday',
        date: yesterday,
        start: '15:00',
        end: '16:00',
        title: 'Yesterday meeting',
      }),
    ])

    renderDashboard()

    expect(await screen.findByText('Today meeting')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))

    expect(screen.getByLabelText('Date')).toHaveValue(yesterday)
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeEnabled()
    expect(await screen.findByText('Yesterday meeting')).toBeInTheDocument()
    expect(screen.queryByText('Today meeting')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByLabelText('Date')).toHaveValue(today)
    expect(await screen.findByText('Today meeting')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByLabelText('Date')).toHaveValue(tomorrow)
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByLabelText('Date')).toHaveValue(today)
    expect(await screen.findByText('Today meeting')).toBeInTheDocument()
  })

  it('lets a past date be chosen from the date input', async () => {
    writeBookings(localStorage, [
      booking({
        id: 'archive',
        date: '2000-01-15',
        start: '09:30',
        end: '10:15',
        title: 'Archive review',
      }),
    ])

    renderDashboard()
    await screen.findByText('No bookings for this date.')

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2000-01-15' } })

    expect(screen.getByLabelText('Date')).toHaveValue('2000-01-15')
    expect(screen.getByRole('heading', { level: 2 }).querySelector('time')).toHaveAttribute(
      'datetime',
      '2000-01-15',
    )
    expect(await screen.findByText('Archive review')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeEnabled()
  })

  it('shows a loading state and then the schedule', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    server.use(
      http.get('/api/bookings', async () => {
        await gate
        return HttpResponse.json([])
      }),
    )

    renderDashboard()

    expect(screen.getByRole('status')).toHaveTextContent('Loading bookings…')
    release?.()
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
  })

  it('shows an error and retries the request', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/bookings', () => {
        return HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
      }),
    )

    renderDashboard()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Bookings could not be loaded.')
    expect(alert).toHaveTextContent('Storage unavailable.')

    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
  })
})
