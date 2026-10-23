import { expect, type Page, test } from '@playwright/test'

declare global {
  interface Window {
    __bookingMock?: {
      use: (...handlers: unknown[]) => void
      reset: () => void
      http: {
        get: (
          path: string,
          resolver: (info: { request: Request }) => Response,
        ) => unknown
        post: (
          path: string,
          resolver: (info: { request: Request }) => Response | Promise<Response>,
        ) => unknown
      }
      HttpResponse: {
        json: (body: unknown, init?: { status?: number }) => Response
        error: () => Response
      }
    }
  }
}

const TODAY = '2026-06-15'
const TOMORROW = '2026-06-16'
const YESTERDAY = '2026-06-14'
const MORNING = new Date(2026, 5, 15, 8, 0, 0).getTime()
const LATE_MORNING = new Date(2026, 5, 15, 11, 0, 0).getTime()

type SeedBooking = {
  id: string
  date: string
  start: string
  end: string
  title?: string
}

function timeRange(start: string, end: string): string {
  return `${start}–${end}`
}

async function installClock(page: Page, time: number, bookings: SeedBooking[]) {
  await page.addInitScript(
    ({ fixedTime, stored }) => {
      const RealDate = globalThis.Date
      const MockDate = function MockDate(...args: unknown[]) {
        return Reflect.construct(RealDate, args.length === 0 ? [fixedTime] : args) as Date
      }
      Object.setPrototypeOf(MockDate, RealDate)
      MockDate.prototype = RealDate.prototype
      Object.defineProperty(MockDate, 'now', { value: () => fixedTime })
      Object.defineProperty(MockDate, 'parse', { value: RealDate.parse })
      Object.defineProperty(MockDate, 'UTC', { value: RealDate.UTC })
      globalThis.Date = MockDate as unknown as DateConstructor
      localStorage.setItem('meeting-room.bookings.v1', JSON.stringify(stored))
      localStorage.setItem('meeting-room.e2e', '1')
    },
    { fixedTime: time, stored: bookings },
  )
}

async function openApp(page: Page, bookings: SeedBooking[] = [], time = MORNING) {
  await installClock(page, time, bookings)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'North Room' })).toBeVisible()
  await expect(page.getByLabel('Date')).toHaveValue(TODAY)
}

async function openCreate(page: Page) {
  await page.getByRole('button', { name: 'New booking' }).click()
  const dialog = page.getByRole('dialog', { name: 'New booking' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Date')).toHaveValue(TODAY)
  return dialog
}

async function fillBooking(
  dialog: ReturnType<Page['getByRole']>,
  values: { date?: string; start?: string; end?: string; title?: string },
) {
  if (values.date !== undefined) await dialog.getByLabel('Date').fill(values.date)
  if (values.start !== undefined) await dialog.getByLabel('Start').fill(values.start)
  if (values.end !== undefined) await dialog.getByLabel('End').fill(values.end)
  if (values.title !== undefined) await dialog.getByLabel(/^Title/).fill(values.title)
}

test('selects a date and shows that day’s bookings', async ({ page }) => {
  await openApp(page, [
    { id: 'today', date: TODAY, start: '10:00', end: '11:00', title: 'Today meeting' },
    { id: 'tomorrow', date: TOMORROW, start: '09:30', end: '10:30', title: 'Tomorrow meeting' },
  ])

  await expect(page.getByText('Today meeting')).toBeVisible()
  await expect(page.getByText('Tomorrow meeting')).toHaveCount(0)

  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByLabel('Date')).toHaveValue(TOMORROW)
  await expect(page.getByText('Tomorrow meeting')).toBeVisible()
  await expect(page.getByText('Today meeting')).toHaveCount(0)

  await page.getByLabel('Date').fill(YESTERDAY)
  await expect(page.getByLabel('Date')).toHaveValue(YESTERDAY)
  await expect(page.getByText('No bookings for this date.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous day' })).toBeEnabled()
})

test('creates a valid booking at an arbitrary minute', async ({ page }) => {
  await openApp(page)
  const dialog = await openCreate(page)
  await fillBooking(dialog, { start: '09:10', end: '09:40', title: 'Planning' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Planning')).toBeVisible()
  await expect(page.getByText(timeRange('09:10', '09:40'))).toBeVisible()
})

test('edits an existing booking', async ({ page }) => {
  await openApp(page, [{ id: 'plan', date: TODAY, start: '10:00', end: '11:00', title: 'Planning' }])
  await page.getByRole('button', { name: `Edit Planning, ${timeRange('10:00', '11:00')}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit booking' })
  await expect(dialog.getByLabel('Start')).toHaveValue('10:00')
  await expect(dialog.getByLabel(/^Title/)).toHaveValue('Planning')
  await fillBooking(dialog, { title: 'Planning updated' })
  await dialog.getByRole('button', { name: 'Save changes' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Planning updated', { exact: true })).toBeVisible()
  await expect(page.getByText('Planning', { exact: true })).toHaveCount(0)
  await expect(page.getByText(timeRange('10:00', '11:00'))).toBeVisible()
})

test('deletes a booking after confirmation', async ({ page }) => {
  await openApp(page, [{ id: 'plan', date: TODAY, start: '10:00', end: '11:00', title: 'Planning' }])
  await page.getByRole('button', { name: `Delete Planning, ${timeRange('10:00', '11:00')}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete booking?' })
  await expect(dialog.getByText('This cannot be undone.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete booking' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('No bookings for this date.')).toBeVisible()
  await expect(page.getByText('Planning')).toHaveCount(0)
})

test('cancels deletion and restores focus', async ({ page }) => {
  await openApp(page, [{ id: 'plan', date: TODAY, start: '10:00', end: '11:00', title: 'Planning' }])
  const trigger = page.getByRole('button', { name: `Delete Planning, ${timeRange('10:00', '11:00')}` })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Delete booking?' })
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.getByText('Planning')).toBeVisible()
})

test('rejects an overlapping booking and keeps the form', async ({ page }) => {
  await openApp(page, [{ id: 'first', date: TODAY, start: '10:00', end: '11:00', title: 'First' }])
  const dialog = await openCreate(page)
  await fillBooking(dialog, { start: '10:30', end: '11:30', title: 'Clash' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()

  await expect(dialog.getByRole('alert')).toHaveText('This time overlaps an existing booking.')
  await expect(dialog.getByLabel('Start')).toHaveValue('10:30')
  await expect(dialog.getByLabel('End')).toHaveValue('11:30')
  await expect(page.getByText('Clash')).toHaveCount(0)
  await expect(page.getByText('First')).toBeVisible()
})

test('allows a booking that starts when another ends', async ({ page }) => {
  await openApp(page, [{ id: 'first', date: TODAY, start: '10:00', end: '11:00', title: 'First' }])
  const dialog = await openCreate(page)
  await fillBooking(dialog, { start: '11:00', end: '12:00', title: 'Follow up' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('First')).toBeVisible()
  await expect(page.getByText('Follow up')).toBeVisible()
})

test('rejects durations outside 30 to 120 minutes', async ({ page }) => {
  await openApp(page)
  const dialog = await openCreate(page)
  await fillBooking(dialog, { start: '09:00', end: '09:20' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Booking must be at least 30 minutes.')

  await fillBooking(dialog, { start: '09:00', end: '11:30' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Booking cannot be longer than 120 minutes.')
  await expect(dialog.getByLabel('End')).toHaveValue('11:30')
})

test('prevents bookings in the past', async ({ page }) => {
  await openApp(page, [], LATE_MORNING)
  const dialog = await openCreate(page)
  await fillBooking(dialog, { date: YESTERDAY, start: '10:00', end: '11:00' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Bookings on a past date are not allowed.')
  await expect(dialog.getByLabel('Date')).toHaveValue(YESTERDAY)

  await fillBooking(dialog, { date: TODAY, start: '10:00', end: '11:00' })
  await dialog.getByRole('button', { name: 'Save booking' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Bookings cannot start in the past.')
  await expect(dialog.getByLabel('Start')).toHaveValue('10:00')
  await expect(page.getByText('No bookings for this date.')).toBeVisible()
})

test('keeps the form and refreshes the schedule after HTTP 409', async ({ page }) => {
  await openApp(page)
  const dialog = await openCreate(page)
  await fillBooking(dialog, { start: '10:00', end: '11:00', title: 'Mine' })
  await page.evaluate((today) => {
    const mock = window.__bookingMock
    if (!mock) {
      throw new Error('Mock control is unavailable')
    }
    let raced = false
    mock.use(
      mock.http.get('/api/bookings', ({ request }) => {
        const date = new URL(request.url).searchParams.get('date')
        const raw = localStorage.getItem('meeting-room.bookings.v1')
        const stored: Array<{ date?: string; id?: string; start?: string; end?: string; title?: string }> = raw
          ? (JSON.parse(raw) as Array<{ date?: string }>)
          : []
        const bookings = stored.filter((item) => item.date === date)
        if (raced && date === today) {
          bookings.push({ id: 'race', date: today, start: '10:00', end: '11:00', title: 'Someone else' })
        }
        return mock.HttpResponse.json(bookings)
      }),
      mock.http.post('/api/bookings', async ({ request }) => {
        const body = (await request.json()) as { end?: string }
        if (body.end === '11:00') {
          raced = true
          return mock.HttpResponse.json(
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
        return mock.HttpResponse.json({ message: 'Unexpected booking.' }, { status: 500 })
      }),
    )
  }, TODAY)

  await dialog.getByRole('button', { name: 'Save booking' }).click()

  const alert = dialog.getByRole('alert')
  await expect(alert).toContainText('This time overlaps an existing booking.')
  await expect(alert).toContainText('Adjust the time and try again.')
  await expect(dialog.getByLabel('Date')).toHaveValue(TODAY)
  await expect(dialog.getByLabel('Start')).toHaveValue('10:00')
  await expect(dialog.getByLabel('End')).toHaveValue('11:00')
  await expect(dialog.getByLabel(/^Title/)).toHaveValue('Mine')
  await expect(page.getByText('Someone else')).toBeVisible()
  await expect(page.getByText('Mine')).toHaveCount(0)
  await expect(dialog).toBeVisible()
})

test('recovers when the booking list fails to load', async ({ page }) => {
  await openApp(page)
  await page.evaluate(() => {
    const mock = window.__bookingMock
    if (!mock) {
      throw new Error('Mock control is unavailable')
    }
    mock.use(
      mock.http.get('/api/bookings', () => {
        return mock.HttpResponse.json({ message: 'Storage unavailable.' }, { status: 500 })
      }),
    )
  })
  await page.getByRole('button', { name: 'Next day' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Bookings could not be loaded.')
  await expect(alert).toContainText('Storage unavailable.')

  await page.evaluate(() => {
    window.__bookingMock?.reset()
  })
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('No bookings for this date.')).toBeVisible()
  await expect(page.getByLabel('Date')).toHaveValue(TOMORROW)
})

test('keeps entered values when the network fails', async ({ page }) => {
  await openApp(page)
  const dialog = await openCreate(page)
  await fillBooking(dialog, { start: '12:00', end: '13:00', title: 'Offline' })
  await page.evaluate(() => {
    const mock = window.__bookingMock
    if (!mock) {
      throw new Error('Mock control is unavailable')
    }
    mock.use(
      mock.http.post('/api/bookings', () => {
        return mock.HttpResponse.error()
      }),
    )
  })
  await dialog.getByRole('button', { name: 'Save booking' }).click()

  await expect(dialog.getByRole('alert')).toContainText('network request failed')
  await expect(dialog.getByLabel('Start')).toHaveValue('12:00')
  await expect(dialog.getByLabel('End')).toHaveValue('13:00')
  await expect(dialog.getByLabel(/^Title/)).toHaveValue('Offline')
  await expect(dialog).toBeVisible()
})

test('opens and closes the create form from the keyboard', async ({ page }) => {
  await openApp(page)
  const trigger = page.getByRole('button', { name: 'New booking' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'New booking' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'New booking' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.getByText('No bookings for this date.')).toBeVisible()
})

test('shows a long title and a 30-minute booking without widening the page', async ({ page }) => {
  const title = 'Quarterly planning session for the north room stakeholders and guests'
  await openApp(page, [
    { id: 'long', date: TODAY, start: '10:00', end: '11:00', title },
    { id: 'short', date: TODAY, start: '14:10', end: '14:40', title: 'Odd slot' },
  ])

  await expect(page.getByRole('button', { name: `Edit ${title}, ${timeRange('10:00', '11:00')}` })).toBeVisible()
  await expect(page.getByRole('button', { name: `Edit Odd slot, ${timeRange('14:10', '14:40')}` })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('fits the schedule and the booking form', async ({ page }) => {
    await openApp(page, [{ id: 'plan', date: TODAY, start: '10:00', end: '11:00', title: 'Planning' }])
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    expect(await overflow()).toBeLessThanOrEqual(1)
    await expect(page.getByRole('button', { name: `Edit Planning, ${timeRange('10:00', '11:00')}` })).toBeVisible()

    const dialog = await openCreate(page)
    await expect(dialog.getByLabel('Start')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save booking' })).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(1)
  })
})
