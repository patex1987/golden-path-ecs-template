# Service Follow-Up Tasks

This file tracks intentional leftovers from the service migration work. These
are not blockers for the current learning slice, but they should be revisited
before treating the template as a production-ready service shape.

## Booking Use-Case Boundaries

- Decide whether `BookingRepository.findById()` should represent a missing
  record as `null`, or whether repository implementations should raise a
  specific error that application use cases translate.
- Split booking query and command behavior when the business rules grow. Query
  use cases may intentionally expose missing records as `null`; command use
  cases such as `requestBookingSync()` may need to fail with an application
  error.
- Decide which concepts belong in `domain/` versus `application/`. The current
  `BookingsService` is acting as the application service/use-case layer, but
  some behavior may move into richer domain objects once real booking rules
  appear.
