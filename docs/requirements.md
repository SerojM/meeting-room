# Requirements

Traceable checklist for the meeting room booking assignment. Items are requirements only when the assignment states them. Edge cases derived from those rules are listed separately. Unspecified behavior is recorded so it is not invented later.

Working hours are 09:00–18:00 in the browser's local timezone.

## Product

- [x] P1. Select a date. Previous day, next day, today, and the native date input all stay on the local calendar. Past dates remain selectable.
- [x] P2. View existing bookings for the selected date on a 09:00–18:00 timeline.
- [x] P3. Create a booking.
- [x] P4. Edit a booking.
- [x] P5. Delete a booking.

## Business rules

- [x] B1. Booking start and end are within 09:00–18:00.
- [x] B2. Start is earlier than end.
- [x] B3. Minimum duration is 30 minutes.
- [x] B4. Maximum duration is 120 minutes.
- [x] B5. Bookings do not overlap.
- [x] B6. Adjacent bookings are allowed (one ends when the next starts).
- [x] B7. A new booking cannot start in the past.
- [x] B8. Creating a booking on a past date is forbidden.
- [x] B9. Editing excludes the current booking from overlap checks.
- [x] B10. The mock server validates these rules independently of the UI.

## Conflicts and states

- [x] C1. The server may return HTTP 409 when the UI treats the slot as available. The mock server returns 409 for overlaps.
- [x] C2. On HTTP 409, preserve the user's input.
- [x] C3. On HTTP 409, display a clear error.
- [x] C4. On HTTP 409, refresh the bookings list.
- [x] U1. Show a loading state while bookings are fetched.
- [x] U2. Show an empty state when the selected date has no bookings.
- [x] U3. Show an error state when bookings fail to load. Retry uses the same date.
- [x] U4. Show a submitting state while create, edit, or delete is in flight.

## Explicit non-requirement

- [x] N1. Booking times do not have to be multiples of 30 minutes. A slot such as 09:10–09:40 is valid when the other rules pass.

## Edge cases

Boundaries:

- [x] E1. Start at 09:00 is valid.
- [x] E2. End at 18:00 is valid.
- [x] E3. Start before 09:00 is invalid.
- [x] E4. End after 18:00 is invalid.
- [x] E5. Duration of exactly 30 minutes is valid.
- [x] E6. Duration of exactly 120 minutes is valid.
- [x] E7. Duration under 30 minutes is invalid.
- [x] E8. Duration over 120 minutes is invalid.
- [x] E9. Start equal to end is invalid.
- [x] E10. End before start is invalid.
- [x] E11. A same-day span from 09:00 to 18:00 is inside working hours and still invalid because it exceeds 120 minutes.

Overlap:

- [x] E12. A booking that ends at the same time another starts is valid.
- [x] E13. Overlap by any positive duration is invalid, including a one-minute overlap, a shared start, or one booking contained in another.
- [x] E14. Several non-overlapping bookings on the same date are valid.
- [x] E15. Saving an edit with no time change is valid because the current booking is excluded.
- [x] E16. An edit that overlaps a different booking is invalid.

Past and present:

- [x] E17. A future date can be booked.
- [x] E18. Yesterday cannot be booked.
- [x] E19. Today can be booked when the start time is not in the past.
- [x] E20. Today cannot be booked when the start time is already past.
- [x] E21. A start time equal to the current local time is not in the past. Comparison uses the current local minute.
- [x] E22. Near 18:00, a start that leaves fewer than 30 minutes before the working-hours end is invalid.
- [x] E23. Past dates can still be viewed. The assignment forbids creating bookings on them, not viewing them.
- [x] E24. Compare instants in the browser's local timezone. Do not treat 09:00 as UTC.

HTTP 409:

- [x] E25. After a 409, previously entered fields are still present.
- [x] E26. After a 409, the list matches the server, including a booking the client had not shown.

## Decisions

- Create and update both reject a past date and a start that is already in the past. The update is checked as the complete booking, so omitted fields keep their previous values.
- Deleting a booking does not re-check those time rules.
- Overlap checks ignore the booking being edited and ignore bookings on other dates.
- Malformed JSON, wrong types, and invalid date or time formats return HTTP 400. A well-formed request that breaks a business rule returns HTTP 422. An overlap returns HTTP 409.
- Invalid dates and times are rejected. They are not rolled forward.
- Successful mutations are stored in this browser under `meeting-room.bookings.v1`. The data is not shared across users, browsers, or devices. Missing or unreadable data is replaced with a short demo schedule that leaves the current day usable. An explicit empty list stays empty.
- The booking form reuses the domain rules. It checks overlap against the latest bookings for the date in the form. If those bookings cannot be loaded, the form does not treat the slot as free and leaves the decision to the server.
- HTTP 409 leaves the form open and keeps every entered value. The message uses the server's conflict text. It says the schedule was updated only after that date's refresh succeeds. If the refresh fails, the message says the schedule could not be refreshed, and the save is not described as failed.
- A successful create or edit is written into the cached schedule before the list refresh. A successful delete is removed from that cache before the refresh. If the refresh fails, the dialog still closes, the mutation is not shown as failed, and the schedule shows the load error with Try again.
- A later server validation response replaces the previous field errors.
- After a successful create or edit, the schedule moves to the booking's date when that date is not already on screen. The previous date and the new date are both refreshed.
- Each timeline hour is 96 pixels so a 30-minute booking can show its edit and delete controls. The schedule layout is otherwise unchanged.
- Today uses the same clock as the schedule.
- Booking queries do not retry automatically. A failed load shows the error and Try again, which requests the same date.
- The production build starts the same mock service worker as local development, with request logging disabled. Only `/api/bookings` is handled. Removing `enableMocking()` in `src/main.tsx` is how the UI switches to a real API. The demo must be served from the site root so `/mockServiceWorker.js` can register. Playwright sets `meeting-room.e2e` in localStorage so it can script a server fault; that control is not attached otherwise.

## Unspecified, do not invent

- Authentication, users, multiple rooms, recurrence, and a required 30-minute grid.

## Engineering

- [x] T1. React + Vite application in this directory.
- [x] T2. TypeScript strict mode.
- [x] T3. Tailwind CSS.
- [x] T4. TanStack Query loads and refreshes bookings for a date through the API client. The booking form uses React Hook Form and Zod, and business rules come from the domain validation.
- [x] T5. Vitest, React Testing Library, and Playwright configured.
- [x] T6. Feature-oriented layout: `src/app`, `src/features/bookings`, `src/shared`.
- [x] T7. Accessible names for controls, keyboard operation, and errors announced with the related field. Date controls are named and keyboard operable. Load failures, form errors, conflicts, and delete failures use an alert. Create, edit, and delete use dialogs. Focus moves into an opened dialog and returns to the control that opened it.
- [x] T8. Domain logic and API access stay separate from React. The schedule view reads bookings only through the API client.

## Assumptions

- A1. There is one meeting room, shown as North Room. The assignment never mentions choosing a room.
