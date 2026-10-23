# AI prompts

Recorded as submitted.

## 2026-10-23 — Initial setup

```text
You are a Senior Frontend Engineer building a production-quality take-home assignment for a Middle Frontend Engineer position.

Your goal is to deliver a clean, maintainable, well-tested application with minimal complexity. Prioritize correctness, readability, accessibility, and pragmatic engineering over unnecessary abstractions.

## Project

Build a meeting room booking application.

Working hours: 09:00–18:00.

Users must be able to:
- Select a date.
- View existing bookings for that date.
- Create, edit, and delete bookings.

Business requirements:
1. Booking start and end must be within 09:00–18:00.
2. Start must be earlier than end.
3. Minimum duration is 30 minutes.
4. Maximum duration is 120 minutes.
5. Bookings must not overlap. Adjacent bookings are allowed.
6. New bookings cannot start in the past.
7. Creating bookings for past dates is forbidden.
8. Editing must exclude the current booking from overlap checks.
9. The server may return HTTP 409 even when the UI considers a slot available.
10. On HTTP 409, preserve user input, display a clear error, and refresh the bookings list.
11. The mock server must independently validate business rules.
12. Support loading, empty, error, and submitting states.

Do not introduce an unsupported requirement that booking times must be multiples of 30 minutes. The minimum duration is 30 minutes, not the scheduling increment.

## Tech Stack

- React + Vite
- TypeScript with strict mode
- Tailwind CSS
- TanStack Query
- React Hook Form + Zod
- MSW for mock API
- Vitest + React Testing Library
- Playwright for E2E tests
- Lucide React icons

Do not add Redux, Zustand, Next.js, or unnecessary dependencies.

## Engineering Rules

- Write simple, readable, idiomatic TypeScript.
- Follow established React patterns.
- Prefer small, focused components.
- Separate domain logic, API access, and UI.
- Avoid premature abstractions and overengineering.
- Avoid `any`, unnecessary type assertions, and suppressed TypeScript errors.
- Do not add comments that merely describe obvious code.
- Avoid decorative comments, emojis, AI-style explanations, and excessive documentation.
- Use descriptive names and predictable control flow.
- Keep date and time handling consistent with the browser's local timezone.
- Do not add functionality outside the assignment requirements.
- Do not modify unrelated files.
- Do not install libraries without a clear purpose.

## Token Efficiency

- Read only files relevant to the current task.
- Avoid repeatedly inspecting unchanged files.
- Keep terminal output and final summaries concise.
- Do not generate lengthy implementation explanations.
- Do not implement future stages prematurely.
- Run focused checks rather than repeatedly rebuilding everything.

## Task: Initial Setup Only

1. Initialize the Vite React TypeScript application in the current project directory.
2. Configure Tailwind CSS.
3. Install and configure the required dependencies.
4. Configure Vitest, React Testing Library, and Playwright.
5. Establish a simple feature-oriented project structure.
6. Create a concise `AGENTS.md` containing persistent engineering and token-efficiency rules.
7. Create `docs/requirements.md` with a complete, traceable checklist of all assignment requirements and important edge cases.
8. Create `docs/ai-prompts.md` to record the actual prompts used during development. Include this initial prompt accurately.
9. Create a minimal application entry point that runs successfully.

Do not implement the booking interface, mock API, or booking validation yet.

## Verification

- Run TypeScript checks.
- Run linting.
- Verify that the application builds.
- Report any failures accurately.

At completion, provide only:
- Files created or changed.
- Verification results.
- Any blockers or important decisions.

Stop after completing this stage.
```

## 2026-10-23 — Domain, validation, mock API, and client

````text
Continue implementing the Meeting Room Booking application.

Act as a pragmatic Senior Frontend Engineer. Prioritize correctness, clean TypeScript, maintainability, and comprehensive business-rule testing without overengineering.

Before making changes:
- Read `AGENTS.md` and `docs/requirements.md`.
- Inspect only the existing files relevant to this stage.
- Preserve the established architecture and tooling.
- Do not repeat project setup or reinstall existing dependencies.

## Goal

Implement the booking domain, validation, API client, mock API, and focused tests.

Do not implement the booking interface yet.

## 1. Domain Model

Use the following API contract:

```ts
type Booking = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  title?: string;
};
```

Support:

- GET `/api/bookings?date=YYYY-MM-DD`
- POST `/api/bookings`
- PATCH `/api/bookings/:id`
- DELETE `/api/bookings/:id`

Use simple, explicit TypeScript types for create and update payloads.

Keep the domain model independent of React and MSW.

## 2. Booking Validation

Implement pure, independently testable functions.

Business rules:

1. Working hours are 09:00–18:00, inclusive of the boundaries.
2. Start must be strictly earlier than end.
3. Minimum booking duration is 30 minutes.
4. Maximum booking duration is 120 minutes.
5. Bookings cannot overlap.
6. Adjacent bookings are valid.
7. Bookings cannot start in the past.
8. Creation on past dates is forbidden.
9. When editing, exclude the current booking ID from overlap checks.
10. Validate both date and time formats strictly.
11. Use the browser's local timezone consistently.
12. Do not impose a 30-minute scheduling grid. Arbitrary minute values are valid when all rules are satisfied.

Overlap detection:

```ts
start < existing.end && end > existing.start
```

Convert times into minutes for comparisons.

Avoid unnecessary date libraries.

Make current time injectable into validation functions so time-dependent scenarios can be tested deterministically.

Return structured validation errors suitable for displaying field-level or form-level messages.

Do not silently normalize invalid dates or times.

## 3. Mock API

Implement the endpoints using the existing MSW setup.

Requirements:

- Keep handlers thin.
- Move storage and validation logic into separate testable modules.
- Validate all create and update requests on the server side.
- Return HTTP 400 for malformed requests.
- Return HTTP 422 for validly shaped requests violating business rules, except overlaps.
- Return HTTP 409 for overlapping bookings.
- Return HTTP 404 for nonexistent booking IDs.
- Return meaningful JSON error responses.
- Return HTTP 204 for successful deletion.
- Generate unique booking IDs.
- Return bookings sorted by start time.

For PATCH, preserve fields not included in the request and validate the complete resulting booking.

Allow editing a booking's date, start, end, and title.

Exclude the current booking from its own overlap checks.

Ensure no partial updates are persisted when validation fails.

## 4. Mock Data Persistence

Implement a small storage adapter using localStorage.

Requirements:

- MSW handlers access storage through the adapter.
- React components must never access booking storage directly.
- Keep storage implementation replaceable.
- Initialize a small set of realistic demo bookings.
- Avoid demo bookings that make the current day unusable.
- Persist successful mutations across page reloads.
- Use a versioned storage key to avoid stale development data.
- Handle invalid or corrupted stored data safely.

Do not introduce a database or unnecessary state-management library.

Document that localStorage persistence is browser-local and not shared across users or devices.

## 5. API Client

Create a small typed API client independent of React.

It must expose:

- `getBookings(date)`
- `createBooking(payload)`
- `updateBooking(id, payload)`
- `deleteBooking(id)`

Requirements:

- Use fetch.
- Handle non-2xx responses explicitly.
- Parse structured API errors.
- Preserve HTTP status codes.
- Expose a typed API error that distinguishes 409 conflicts from validation, network, and other server errors.
- Support AbortSignal where appropriate.
- Handle 204 responses without attempting to parse JSON.
- Do not use Axios or unnecessary wrappers.

Do not create TanStack Query hooks yet unless they are required for testing the API client.

## 6. Tests

Write meaningful Vitest tests covering:

Validation:
- Exact 09:00 start and 18:00 end boundaries.
- Start before 09:00.
- End after 18:00.
- Start equal to end.
- End earlier than start.
- Exactly 30 minutes.
- Less than 30 minutes.
- Exactly 120 minutes.
- More than 120 minutes.
- Arbitrary minute values.
- Full overlap.
- Partial overlap.
- Containment.
- Adjacent intervals.
- Editing without changing the original interval.
- Editing into another booking's interval.
- Past dates.
- Today's past start time.
- Today's future start time.
- Invalid date and time formats.

Mock API:
- GET returns sorted bookings.
- POST creates a booking.
- PATCH updates a booking.
- DELETE removes a booking.
- Invalid requests return appropriate errors.
- Overlaps return 409.
- Failed mutations do not change stored bookings.
- Nonexistent IDs return 404.
- Successful mutations persist.

API client:
- Successful responses.
- Structured validation errors.
- Conflict errors.
- Network errors.
- Empty 204 responses.

Avoid tests that only assert implementation details. Test observable behavior.

Ensure tests are isolated and do not depend on the real current date or existing localStorage contents.

## 7. Verification

Run:
- TypeScript checks
- Lint
- Unit tests
- Production build

Fix any failures introduced by this stage.

Update `docs/requirements.md` to reflect implemented and tested requirements.

Append this actual prompt to `docs/ai-prompts.md`.

Do not claim tests passed unless they were executed successfully.

## Constraints

- Do not build UI components.
- Do not change unrelated configuration.
- Do not add unnecessary dependencies.
- Do not add verbose comments or documentation.
- Avoid generic repositories, service factories, or excessive abstractions.
- Keep functions small and naming clear.
- Do not weaken validation to make tests pass.
- Do not add artificial delays to API requests.

At completion, provide a concise summary of:
1. Files changed.
2. Domain and API behavior implemented.
3. Test results and counts.
4. Any remaining limitations or important decisions.

Stop after completing this stage.
````

## 2026-10-23 — Date selection and schedule view

```text
Continue the Meeting Room Booking application.

Act as a pragmatic Senior Frontend Engineer with strong UI/UX and accessibility experience.

Read `AGENTS.md`, `docs/requirements.md`, and only the files relevant to this stage.

Preserve the existing domain logic, API client, mock handlers, and test coverage.

## Goal

Build a clean, responsive, accessible meeting room booking interface focused on selecting a date and viewing bookings.

Do not implement booking mutations yet.

## Design Direction

Create a polished, minimal scheduling interface suitable for a professional SaaS application.

Prioritize:
- Clear information hierarchy.
- Consistent spacing and typography.
- Excellent readability.
- Subtle borders and neutral backgrounds.
- One restrained primary accent color.
- Responsive layouts.
- Accessible interactions.

Avoid:
- Overly decorative dashboards.
- Excessive gradients and shadows.
- Unnecessary animations.
- Complex calendar libraries.
- Drag-and-drop scheduling.
- Large component abstractions.

## 1. Application Layout

Build a booking dashboard containing:

- A concise application header.
- Meeting room name.
- Working hours: 09:00–18:00.
- Selected date.
- Date navigation controls.
- A native date picker.
- A day timeline.
- A clear primary "New booking" action.

Use Lucide React icons where appropriate.

The New booking action may remain disabled or non-interactive until the CRUD stage. Do not present a clickable control that performs no action.

## 2. Date Selection

Implement:
- Previous day navigation.
- Next day navigation.
- Today shortcut.
- Native date input.
- Local date handling without UTC conversion bugs.

Past dates must remain selectable because users can view historical bookings.

Do not disable historical date navigation.

The selected date should drive the booking query.

## 3. Booking Data

Use the existing typed API client and TanStack Query.

Create a focused query hook for fetching bookings by selected date.

Requirements:
- Query keys include the selected date.
- Handle loading, error, and success states.
- Support request cancellation where appropriate.
- Do not duplicate server state in React state.
- Do not directly access localStorage.
- Do not bypass the API client.
- Keep query
```

## 2026-10-23 — Booking CRUD

```text
Continue the Meeting Room Booking application.

Act as a pragmatic Senior Frontend Engineer. Focus on correct business behavior, predictable state management, accessibility, and readable code.

Read `AGENTS.md`, `docs/requirements.md`, and only the files relevant to this stage.

Preserve the existing architecture, domain validation, API client, mock API, timeline, and tests.

## Goal

Implement complete booking CRUD functionality with reliable client-side validation, server error handling, and TanStack Query integration.

Do not redesign the existing dashboard.

## 1. Booking Form

Implement a reusable form for creating and editing bookings.

Fields:
- Date
- Start time
- End time
- Optional title

Use React Hook Form and Zod, reusing existing domain validation wherever possible.

Requirements:
- Clearly distinguish create and edit modes.
- Use controlled, predictable form state.
- Display field-level validation errors.
- Prevent duplicate submissions.
- Preserve user input after failed requests.
- Reset the form only after successful mutations or explicit cancellation.
- Do not silently modify user-selected times.
- Keep form state independent of query cache state.

Use native date and time inputs where practical.

Do not restrict time selection to 30-minute increments. Valid arbitrary-minute values must remain supported.

## 2. Create Booking

Enable the existing New booking action.

Requirements:
- Open an accessible booking form.
- Preselect the currently viewed date.
- Allow users to change the booking date.
- Prevent creation for past dates.
- Prevent start times in the past on the current date.
- Validate working hours, duration, and overlaps.
- Send the request through the existing API client.
- Show a submitting state.
- Close and reset the form only after successful creation.
- Refresh bookings for the affected date.
- If the created booking is on a different date, navigate to that date so the result is visible.

Do not rely exclusively on client-side validation.

## 3. Edit Booking

Allow users to edit existing bookings.

Requirements:
- Populate the form with the selected booking.
- Allow editing date, start, end, and title.
- Exclude the booking's own ID from overlap checks.
- Validate against bookings on the target date.
- Preserve unchanged fields correctly.
- Handle editing across dates.
- Refresh both the original and target dates after success.
- Preserve form values after failed requests.
- Do not silently allow moving a booking into the past.

Follow the existing mock API behavior for past bookings. Do not introduce new restrictions without documenting them.

## 4. Delete Booking

Allow users to delete a booking.

Requirements:
- Provide an accessible delete action.
- Require explicit confirmation before deletion.
- Show a pending state.
- Prevent duplicate deletion requests.
- Use the existing API client.
- Refresh the affected date after success.
- Handle failed deletion without incorrectly removing the booking from the UI.
- Do not introduce unnecessary optimistic updates.

## 5. Client Validation

Reuse the existing pure domain validation functions.

Ensure:
- Start is earlier than end.
- Start and end are within 09:00–18:00.
- Duration is between 30 and 120 minutes inclusive.
- Adjacent bookings are allowed.
- Overlapping bookings are rejected.
- Editing excludes the current booking.
- Past-date creation is blocked.
- Today's past start times are blocked.
- Arbitrary-minute values remain valid.

Perform a fresh time validation immediately before submission.

Use the latest available bookings for overlap checks.

If bookings for a newly selected target date have not loaded, do not treat that date as conflict-free based on missing cache data. Fetch the relevant bookings or rely on server validation without presenting an incorrect availability claim.

Keep the server authoritative.

## 6. HTTP 409 Conflict Handling

This is a critical acceptance requirement.

The server may reject a booking with HTTP 409 even if the UI previously considered the slot available.

On conflict:
1. Keep the form open.
2. Preserve all entered values.
3. Show a clear, actionable conflict message.
4. Refresh the bookings list for the conflicting date.
5. Allow the user to adjust the time and retry.
6. Do not reset the form.
7. Do not automatically retry the mutation.
8. Do not overwrite the user's input with server data.

Handle conflicts separately from validation, network, and unexpected server errors.

Do not assume client-side validation eliminates race conditions.

## 7. TanStack Query

Use focused mutation hooks or straightforward useMutation calls.

Requirements:
- Invalidate relevant booking query keys after successful mutations.
- Invalidate and actively refresh the conflicting date after HTTP 409, including when that date differs from the currently displayed date.
- Avoid duplicating server state in local component state.
- Avoid unnecessary refetches.
- Preserve existing query cancellation behavior.
- Do not implement optimistic updates.

## 8. Accessibility and UX

Requirements:
- Keyboard-accessible create, edit, and delete actions.
- Accessible dialog or form presentation.
- Appropriate labels and error associations.
- Visible focus indicators.
- Focus moves into an opened dialog and returns to the triggering control when it closes.
- Escape and Cancel close the form without saving.
- Pending operations have clear visual feedback.
- Errors are announced accessibly.
- Confirmation is required before destructive actions.
- Form remains usable on mobile screens.

Use native semantics where possible.

Avoid introducing a large UI framework solely for dialogs.

## 9. Tests

Add meaningful React Testing Library integration tests covering:

- Opening and cancelling the create form.
- Successful creation.
- Creating on a different date.
- Validation of working hours.
- Minimum and maximum duration.
- Past-date and past-time restrictions.
- Adjacent booking acceptance.
- Overlap rejection.
- Editing an existing booking without self-conflict.
- Editing into another booking's interval.
- Editing across dates.
- Successful deletion.
- Cancelled deletion.
- Failed deletion.
- Duplicate submission prevention.
- Server validation errors.
- Network errors.
- HTTP 409 conflict behavior.

For HTTP 409, explicitly verify:
- Form stays open.
- User input remains unchanged.
- An actionable error is displayed.
- The relevant booking query is refreshed.
- The user can retry with different values.

Use deterministic time in tests.

Avoid testing only mocked implementation details.

## 10. Verification

Run:
- TypeScript checks.
- Lint.
- Unit and integration tests.
- Production build.

Fix any failures introduced by this stage.

Update `docs/requirements.md`.

Append this actual prompt to `docs/ai-prompts.md`.

## Constraints

- Do not redesign the dashboard.
- Do not add unnecessary dependencies.
- Do not modify unrelated configuration.
- Do not weaken existing validation.
- Do not introduce new booking restrictions.
- Do not add excessive comments.
- Do not implement drag-and-drop.
- Do not add optimistic updates.
- Keep the code simple and maintainable.

At completion, report:
1. Files changed.
2. CRUD behavior implemented.
3. Test results.
4. Any unresolved issues or important decisions.

Stop after completing this stage.
```

## 2026-10-23 — Final review

```text
You are performing the final engineering review of the Meeting Room Booking take-home assignment.

Act as a pragmatic Senior Frontend Engineer and code reviewer.

The application already includes booking CRUD, domain validation, MSW mock API, TanStack Query, React Hook Form, Zod, and tests.

Your goal is to verify correctness, fix confirmed issues, and prepare a reliable production demo.

Do not rewrite working code or introduce unnecessary abstractions.

## 1. Review Requirements

Read:
- AGENTS.md
- docs/requirements.md
- Relevant implementation files

Audit every requirement against the actual code and tests.

Pay particular attention to:
- Working hours 09:00–18:00.
- Minimum duration 30 minutes.
- Maximum duration 120 minutes.
- Arbitrary minute precision.
- Adjacent bookings.
- Overlap detection.
- Editing without self-conflict.
- Past-date and past-time restrictions.
- HTTP 409 handling.
- Form preservation after errors.
- Loading, empty, error, and submitting states.

Do not assume an existing test proves correctness without inspecting its assertions.

## 2. Production Mock API

Verify whether MSW starts in production builds.

The deployed frontend must work without a real backend.

If MSW currently starts only in development, fix this.

Requirements:
- Enable MSW in the production demo.
- Keep the mock API replaceable with a real backend.
- Avoid intercepting unrelated requests.
- Ensure the service worker is available in the production build.
- Preserve existing localStorage persistence.
- Do not expose development-only debugging behavior unnecessarily.
- Verify that production GET, POST, PATCH, and DELETE requests work.

Prefer a small, explicit configuration over environment-specific complexity.

## 3. Real Browser E2E Tests

Expand Playwright tests to cover actual user interactions.

Test:
1. Select a date and view bookings.
2. Create a valid booking.
3. Edit an existing booking.
4. Delete a booking after confirmation.
5. Cancel deletion.
6. Reject overlapping bookings.
7. Allow adjacent bookings.
8. Reject invalid durations.
9. Prevent creation in the past.
10. Preserve form values after a server-side HTTP 409.
11. Refresh bookings after HTTP 409.
12. Recover from a server or network error where practical.

Use deterministic dates and isolated test data.

For the HTTP 409 scenario, simulate a booking becoming unavailable after the form is opened but before submission.

Verify the actual user-visible behavior, not only API calls.

Avoid arbitrary sleeps and fragile selectors.

Use accessible roles and labels where possible.

## 4. UI and Accessibility Audit

Check:
- Desktop layout.
- Mobile layout at approximately 375px.
- No horizontal overflow.
- Keyboard navigation.
- Visible focus states.
- Native dialog focus behavior.
- Escape and Cancel behavior.
- Focus restoration after closing dialogs.
- Form labels and error messages.
- Error announcements.
- Disabled and submitting states.
- Delete confirmation behavior.
- Long booking titles.
- Booking cards with minimum 30-minute duration.

Fix confirmed usability or accessibility problems.

Do not redesign the application.

## 5. Date and Time Edge Cases

Review:
- Local date handling.
- Midnight transitions.
- Today's past start times.
- Bookings near 18:00.
- Date changes during form editing.
- Cross-date editing.
- Validation immediately before submission.
- Current-minute behavior.
- Correct query invalidation after mutations.

Add focused tests for any uncovered high-risk cases.

## 6. Code Quality

Review for:
- Unnecessary abstractions.
- Duplicated validation logic.
- Unsafe TypeScript.
- Stale closures.
- Incorrect React hook dependencies.
- Race conditions.
- Unnecessary rerenders.
- Excessive comments.
- Unused dependencies.
- Misleading error messages.

Only refactor where there is a clear correctness or maintainability benefit.

## 7. README

Update README with:
- Project overview.
- Tech stack.
- Installation and local development commands.
- Test commands.
- Production build instructions.
- Implemented features.
- Known limitations.
- Mock API and localStorage behavior.
- Deployment instructions.
- Time spent: leave an explicit placeholder for the developer to fill in accurately.

Do not invent development time.

Ensure docs/ai-prompts.md contains the actual prompts used, including this review prompt.

## 8. Verification

Run:
- TypeScript checks.
- Lint.
- Unit and integration tests.
- Playwright E2E tests.
- Production build.
- Production preview smoke test.

Do not claim browser scenarios passed unless actually executed.

Fix confirmed failures.

## 9. Final Report

Provide a concise report with:

1. Confirmed issues discovered.
2. Fixes applied.
3. Files changed.
4. Unit/integration test results.
5. E2E test results.
6. Production preview verification.
7. Remaining limitations.
8. Any requirements not fully satisfied.

Stop after this review.

Do not deploy automatically or create a Git commit.
```

## 2026-10-23 — Refresh failure review

```text
Perform a small, targeted reliability review of the existing Meeting Room Booking application.

Do not redesign the UI, rewrite the architecture, or introduce new dependencies.

Review these specific cases:

1. A POST or PATCH succeeds, but the subsequent TanStack Query invalidation/refetch fails. Ensure the UI does not treat the booking mutation as failed or allow accidental duplicate submission. Keep successful mutation handling separate from refresh failures.

2. HTTP 409 handling must preserve all form values and display an accurate message. Do not claim the schedule was refreshed until the refresh actually succeeds. Handle refresh failure gracefully.

3. Verify that server-side validation errors are cleared or updated appropriately when the user corrects fields and resubmits.

4. Ensure successful deletion is not misrepresented as a failed deletion if the subsequent list refresh fails.

Add focused regression tests for confirmed issues.

Keep the implementation minimal and preserve existing behavior.

Run typecheck, lint, unit tests, E2E tests, and production build.

Update docs/requirements.md and append this actual prompt to docs/ai-prompts.md.

Report only confirmed defects, changes, and verification results. Do not deploy or commit.
```
