# Agent guide

## Engineering

- Write simple, readable TypeScript. Keep strict mode enabled.
- Prefer small, focused components and straightforward control flow.
- Separate domain logic, API access, and UI. Avoid premature abstractions.
- Keep date and time handling in the browser's local timezone.
- Minimum booking duration is 30 minutes. Do not require times to fall on 30-minute marks.
- The mock server must enforce business rules on its own.
- On HTTP 409, keep the entered values, show a clear error, and refresh the bookings list.
- Avoid `any`, unnecessary assertions, and suppressed TypeScript errors.
- Do not add comments that restate the code.
- Do not add Redux, Zustand, Next.js, or dependencies without a clear purpose.
- Do not add behavior that is not in `docs/requirements.md`.

## Layout

- `src/app` — application shell and providers
- `src/features/bookings` — booking feature
- `src/shared` — shared API helpers, utilities, and UI
- `src/mocks` — MSW handlers
- `e2e` — Playwright tests

## Token efficiency

- Read only the files required for the current change.
- Do not re-read files that have not changed.
- Keep command output and final summaries short.
- Do not implement a later stage before it is requested.
- Run the narrowest check that can verify the change.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
