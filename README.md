# Meeting room booking

North Room is a single-room schedule for local working hours, 09:00–18:00. Pick a date, see the day's bookings, and create, edit, or delete them.

Bookings stay in this browser. They are not shared across users or devices.

## Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS
- TanStack Query
- React Hook Form and Zod
- MSW for the mock API
- Vitest and React Testing Library
- Playwright

## Local development

```bash
npm install
npm run dev
```

The app is served at `http://127.0.0.1:5173` and registers the mock service worker before the first booking request.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

End-to-end tests use a fixed local clock of 15 June 2026 and an empty or seeded booking list, so they do not depend on the current time.

## Production build

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`npm run build` typechecks and writes the static demo to `dist/`. The preview serves that build. The production bundle starts the same mock API as development, with request logging turned off. Only `/api/bookings` is mocked.

## Features

- Choose a date, including past dates, and view that day's 09:00–18:00 timeline.
- Create, edit, and delete bookings. Delete asks for confirmation.
- Times may fall on any minute. A booking must start before it ends, stay inside working hours, and last 30 to 120 minutes.
- Adjacent bookings are allowed. Overlaps are rejected, including when the server returns HTTP 409 after the form was opened.
- A failed save keeps the entered values. A failed delete leaves the booking on the schedule.

## Mock API and storage

Successful changes are stored under `meeting-room.bookings.v1` in localStorage. If that entry is missing or unreadable, the mock API seeds a short demo day. An explicit empty list stays empty.

The browser client calls `/api/bookings`. The mock service worker answers those calls in both development and the production demo. Other requests are left alone.

To use a real API, remove the `enableMocking()` call in `src/main.tsx` and serve the same routes. The UI does not read localStorage itself.

## Deployment

Serve the `dist` directory from the site root over HTTPS, or on localhost. The service worker is `mockServiceWorker.js` and must be available at `/mockServiceWorker.js`. A static host is enough; there is no separate backend in the demo.

## Known limitations

- One room, no accounts, and no recurring bookings.
- Data does not leave this browser.
- Creating or editing a booking cannot move it onto a past date or a start time that is already past. Past days can still be viewed, and bookings on them can be deleted.
- The site must be hosted at the domain root so the service worker can register.

## Time spent

Replace this line with the actual time spent before submission.
