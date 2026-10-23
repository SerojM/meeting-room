export type Booking = {
  id: string
  date: string
  start: string
  end: string
  title?: string
}

export type CreateBookingInput = {
  date: string
  start: string
  end: string
  title?: string
}

export type UpdateBookingInput = {
  date?: string
  start?: string
  end?: string
  title?: string
}

export type BookingField = 'date' | 'start' | 'end' | 'title' | 'form'

export type BookingIssue = {
  field: BookingField
  code: string
  message: string
}
