import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App.tsx'
import { AppProviders } from '../app/providers.tsx'
import { writeBookings } from '../features/bookings/storage.ts'

describe('App', () => {
  it('renders the meeting room schedule', async () => {
    writeBookings(localStorage, [])

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    )

    expect(screen.getByRole('heading', { name: 'North Room' })).toBeInTheDocument()
    expect(await screen.findByText('No bookings for this date.')).toBeInTheDocument()
  })
})
