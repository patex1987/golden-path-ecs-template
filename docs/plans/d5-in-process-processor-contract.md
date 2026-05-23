# Implementation Plan: D5 In-Process Processor Contract

## 1. Summary

Add an application-level `ReservationRequestProcessor` contract and an in-memory implementation that can claim pending reservation requests, process them deterministically, and update request/reservation state without introducing a durable queue, worker runtime, or database yet.

The recommended approach is to keep the processor as a plain TypeScript application service behind a small contract, backed by new repository methods that make the state changes explicit. NestJS should only wire the processor into the composition module. Tests should call the processor directly so the workflow is deterministic and does not depend on timers or background loops.

GitHub issue: [#2 D5: Add In-Process Processor Contract](https://github.com/patex1987/golden-path-ecs-template/issues/2)

## 2. Goals

- Add a `ReservationRequestProcessor` contract for processing pending reservation requests.
- Add an in-memory implementation for the first processor behavior.
- Support `REQUESTED -> PROCESSING -> CONFIRMED` when seats are available.
- Support `REQUESTED -> PROCESSING -> REJECTED` when requested seats are already taken.
- Make already-terminal request processing idempotent and safe to retry.
- Keep processing deterministic in tests by calling the processor directly.
- Keep durable queues, worker runtimes, Postgres, and lease-based concurrency for later deliverables.

## 3. Non-goals

- No SQS, worker process, background interval, cron loop, or outbox.
- No Postgres, Knex migrations, or database transactions.
- No GraphQL subscription or push notification mechanism.
- No public GraphQL mutation whose only purpose is to run the processor.
- No full production concurrency guarantee; the in-memory repository only models the contract that durable persistence will later enforce.

## 4. Current State

- `movie-reservation-service/src/domain/movie-reservations/reservation-request.ts` already defines the request lifecycle helpers:
  - `createReservationRequest`
  - `startProcessingReservationRequest`
  - `confirmReservationRequest`
  - `rejectReservationRequest`
  - `failReservationRequest`
- `movie-reservation-service/src/domain/movie-reservations/reservation-request-status.ts` already defines `REQUESTED`, `PROCESSING`, `CONFIRMED`, `REJECTED`, and `FAILED`.
- `movie-reservation-service/src/domain/movie-reservations/reservation.ts` is currently a data interface for confirmed reservations. There is no domain factory yet for creating a reservation from a confirmed request.
- `movie-reservation-service/src/application/movie-reservations/movie-reservations.service.ts` creates new requests in `REQUESTED` state and returns immediately. It does not trigger processing.
- `movie-reservation-service/src/application/movie-reservations/ports/movie-reservation-repository.ts` supports read operations, `saveReservationRequest`, and `findReservationById`, but it cannot update reservation request state, claim pending work, save a confirmed reservation, or check for confirmed seat conflicts.
- `movie-reservation-service/src/infrastructure/repositories/in-memory/in-memory-movie-reservation.repository.ts` stores requests and reservations in maps. Seed data already includes confirmed reservations for seats `seat-aurora-1-a1`, `seat-aurora-1-a2`, and `seat-riverton-1-b3`.
- `movie-reservation-service/src/di/movie-reservations/movie-reservations-composition.module.ts` wires authentication, authorization, the in-memory repository, and `MovieReservationsService`. It does not expose a processor provider or token.
- `movie-reservation-service/test/unit/domain/movie-reservation-domain.test.ts` already covers request validation and basic status transition rules.
- `movie-reservation-service/test/integration/api/graphql.test.ts` verifies that `requestReservation` creates a `REQUESTED` request and that clients can poll it by id. D5 should not make this test timer-dependent.
- `docs/plans/movie-reservation-platform-roadmap.md` says D5 should avoid timer-heavy tests and drive the processor deterministically.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Add `ReservationRequestProcessor` contract.
- Add an in-memory implementation for claiming and processing pending reservation requests.
- Wire the processor through application/service boundaries without introducing external queues.
- Tests cover `REQUESTED -> PROCESSING -> CONFIRMED`.
- Tests cover rejection when requested seats are already taken.
- Tests cover idempotent processing behavior for already-terminal requests.
- Tests can drive processing deterministically.
- No durable queue or worker runtime is introduced yet.
- Verification includes `npm -w movie-reservation-service test` and `npm -w movie-reservation-service run check`.

### Assumptions

- `requestReservation` should continue returning a `REQUESTED` request immediately. The processor should be a separate application service that tests and future worker entrypoints can call.
- The first processor can process one request at a time by id and/or by "next pending" claim. Processing by id is useful for deterministic tests; claiming the next pending request models future worker behavior.
- The processor should not take `ActorContext`. It is an internal application workflow that works from persisted request data and provider-scoped reservation rules, not from a caller's GraphQL identity.
- A confirmed request should create a `Reservation` record linked by `reservationRequestId`.
- A seat conflict means a confirmed reservation already exists for the same `screeningId` and at least one requested `seatId`.
- Already-terminal requests are safe no-ops. Reprocessing `CONFIRMED`, `REJECTED`, or `FAILED` should not throw or create duplicate reservations.
- `PROCESSING` requests should be treated carefully. For this in-memory step, they can be skipped or failed explicitly rather than reclaimed silently; durable claim leases come later with Postgres.

### Open Questions

- Should the processor contract expose both `processNextPendingRequest()` and `processReservationRequestById(id)`, or only the id-based method for D5?
- Should generated reservation ids and `confirmedAt` timestamps be injected through small test fakes now, or should tests assert shape only and leave deterministic ids/timestamps for a later refinement?
- Should a missing request return a typed "not found" processor result, or should that case be outside the D5 contract?

Recommended defaults if no further clarification is given:

- Add both `processNextPendingRequest()` and `processReservationRequestById(id)` because they serve different needs: future worker polling and deterministic tests.
- Keep id/time generation inside the in-memory processor for now, but return the created reservation from the processor result so tests do not need to predict generated values.
- Use typed processor result objects instead of throwing for normal workflow outcomes.

## 6. Proposed Design

Add a new application contract under `movie-reservation-service/src/application/movie-reservations/ports/reservation-request-processor.ts`.

The processor contract should return typed outcomes rather than forcing tests or callers to infer behavior from thrown errors:

```ts
export interface ReservationRequestProcessor {
  processNextPendingRequest(): Promise<ReservationRequestProcessingResult>;
  processReservationRequestById(
    reservationRequestId: ReservationRequestId,
  ): Promise<ReservationRequestProcessingResult>;
}
```

The result type should distinguish normal workflow outcomes:

- `confirmed`: request was claimed, processed, confirmed, and a reservation was created.
- `rejected`: request was claimed and rejected because at least one requested seat was already confirmed for the screening.
- `skipped`: no pending request existed, the request was not found, or the request was already terminal.
- `failed`: an unexpected technical error happened after claim and the request was moved to `FAILED`.

Keep the implementation in `movie-reservation-service/src/application/movie-reservations/in-process-reservation-request.processor.ts` or a similarly named application file. It is application code, not infrastructure, because it coordinates domain transitions and repository operations. It should depend on a repository port, not on the concrete in-memory repository.

Extend repository capabilities in the application port. The existing `MovieReservationRepository` can grow if this stays small, but a more explicit option is a dedicated processing-oriented port such as `ReservationRequestProcessingRepository`. The safer D5 default is to add focused methods to the existing port only if the method count remains readable:

- `findNextRequestedReservationRequest(): Promise<ReservationRequest | null>` or `claimNextRequestedReservationRequest(): Promise<ReservationRequest | null>`
- `claimReservationRequestById(id): Promise<ReservationRequest | null>`
- `updateReservationRequest(reservationRequest): Promise<void>`
- `saveReservation(reservation): Promise<void>`
- `findReservationByRequestId(reservationRequestId): Promise<Reservation | null>`
- `findConfirmedReservationForSeats(screeningId, seatIds): Promise<Reservation | null>`

Prefer claim methods that both find a `REQUESTED` request and transition it to `PROCESSING`. That is the cleanest model for future database-backed atomic claims. In memory, the operation can update the map synchronously before returning the claimed request.

Processor flow:

1. Claim a `REQUESTED` request and store it as `PROCESSING`.
2. If no request is available, return `skipped`.
3. If a confirmed reservation already exists for the same screening and one of the requested seats, update the request to `REJECTED` and return `rejected`.
4. If no conflict exists, create a `Reservation` linked to the request, save it, update the request to `CONFIRMED`, and return `confirmed`.
5. If an unexpected error occurs after claim, update the request to `FAILED` and return or throw according to a deliberate error contract. For D5, returning `failed` keeps retry tests straightforward.

Wire the processor through `MovieReservationsCompositionModule` using a new provider token such as `RESERVATION_REQUEST_PROCESSOR`. Export it so integration tests and future entrypoints can resolve the contract through Nest DI.

Keep GraphQL behavior stable. The existing mutation can still return `REQUESTED`; tests can create a request through GraphQL, resolve the processor through the test module only if useful, run processing, then poll by id. Unit/integration processor tests can cover most behavior without starting the HTTP server.

## 7. Alternatives Considered

### Alternative A: Confirm Inside `requestReservation`

- Pros: Smallest user-visible behavior change; no separate processor surface.
- Cons: Hides the asynchronous workflow this deliverable is meant to teach, makes polling less meaningful, and does not create a contract a future worker can implement.
- Decision: Rejected.

### Alternative B: Add a Timer-Based Background Processor

- Pros: Looks closer to a running worker from the outside.
- Cons: Makes tests slower and flaky, creates lifecycle/shutdown concerns, and conflicts with the roadmap instruction to drive processing deterministically.
- Decision: Rejected for D5. This can be revisited when there is a real worker entrypoint or queue signal.

### Alternative C: Add an Application Processor Contract and In-Memory Implementation

- Pros: Keeps the workflow explicit, testable, and aligned with future worker/queue adapters. It also keeps NestJS as composition wiring instead of putting business logic in resolvers.
- Cons: Requires a few new types and repository methods before durable persistence exists.
- Decision: Recommended.

### Alternative D: Split Processor Persistence Into a Separate Port Immediately

- Pros: Makes claim/update/seat-conflict responsibilities very explicit and avoids bloating the read repository.
- Cons: Adds another abstraction before there is a second persistence implementation.
- Decision: Defer unless the repository interface becomes hard to read during implementation. Start with focused methods on the existing port, then split if the processing methods clearly dominate the contract.

## 8. API / Interface Changes

Internal TypeScript interfaces:

- Add `ReservationRequestProcessor`.
- Add `ReservationRequestProcessingResult` and related result variants.
- Extend repository persistence behavior for claiming requests, updating request status, saving reservations, finding reservations by request id, and detecting confirmed seat conflicts.
- Add a DI token for the processor, likely `RESERVATION_REQUEST_PROCESSOR`.

GraphQL:

- No required schema change for D5.
- Existing polling behavior should observe status changes after the processor runs.

Commands:

- No new npm commands.

Events/queues:

- None in D5.

## 9. Data Model / Persistence Changes

No durable schema changes.

In-memory persistence changes:

- Store updated reservation requests after processing transitions.
- Store newly confirmed reservations.
- Detect conflicts against confirmed reservations in the same screening.
- Avoid duplicate reservations for the same `reservationRequestId`.

Future Postgres compatibility:

- The claim operation should map cleanly to a transactional update from `REQUESTED` to `PROCESSING`.
- Seat conflict detection should later become database-backed with a transaction and uniqueness guarantee on confirmed `(screening_id, seat_id)` rows.
- Idempotency by `reservationRequestId` should map cleanly to a unique reservation request reference.

Rollback:

- Since there is no durable migration, rollback is a git revert of the D5 code and tests.

## 10. Security, Privacy, and Abuse Considerations

- The processor is an internal application workflow, not a caller-authorized API. It should not accept `movieProviderId`, `userId`, or privileged flags from GraphQL input.
- Tenant isolation still matters inside the workflow: reservations created from a request must preserve the request's `movieProviderId`, `screeningId`, `seatIds`, and `requestedByUserId`.
- Do not expose a public GraphQL "process request" command. That would let external callers drive internal worker behavior and create confusing authorization semantics.
- Avoid logging full tokens or secrets. D5 does not need additional token handling.
- Normal conflicts should become `REJECTED`, not uncaught technical errors. Unexpected exceptions after claim should become `FAILED` or a typed failure result so the state is inspectable through polling.

## 11. Performance, Scalability, and Reliability Considerations

- In-memory maps are acceptable for D5 and local tests, but they do not provide cross-process safety.
- The in-memory claim method should still model future atomicity: claim only `REQUESTED` requests and immediately persist `PROCESSING` before business checks.
- `processNextPendingRequest()` should process at most one request per call. A future worker loop can call it repeatedly with backoff when durable persistence exists.
- Conflict detection can scan in-memory reservations for now. The later database implementation should use indexes and uniqueness constraints.
- Idempotent processing avoids duplicate reservations when a caller retries after a successful confirmation.
- Avoid timer-based loops in the Nest app. Timers introduce shutdown, backoff, duplicate work, and test flakiness concerns that belong in a later worker deliverable.

## 12. Implementation Steps

1. Add processor-focused tests first.
   - Change: Create tests that construct an in-memory repository, processor, and known request state.
   - Files/modules likely affected: `movie-reservation-service/test/unit/application/reservation-request-processor.test.ts` or `movie-reservation-service/test/integration/application/reservation-request-processor.test.ts`.
   - Notes: Prefer direct construction over Nest TestingModule unless testing DI wiring.
   - Verification: Focused test run should initially fail.

2. Add or refine domain/application helpers for reservation creation.
   - Change: Add a small factory or helper for creating a `Reservation` from a confirmed request if it improves clarity.
   - Files/modules likely affected: `movie-reservation-service/src/domain/movie-reservations/reservation.ts` or `movie-reservation-service/src/application/movie-reservations`.
   - Notes: Keep TypeScript types explicit. Do not add runtime validation unless new caller-provided input appears.
   - Verification: Existing domain tests still pass; add a unit test only if the helper has meaningful behavior.

3. Add the processor contract and result types.
   - Change: Define `ReservationRequestProcessor` and typed processing outcomes.
   - Files/modules likely affected: `movie-reservation-service/src/application/movie-reservations/ports/reservation-request-processor.ts`.
   - Notes: Result types should make retries and terminal skips clear without throwing for normal outcomes.
   - Verification: Typecheck once implementation begins using the contract.

4. Extend repository processing operations.
   - Change: Add claim, update, save reservation, request-id lookup, and seat-conflict lookup methods.
   - Files/modules likely affected: `movie-reservation-service/src/application/movie-reservations/ports/movie-reservation-repository.ts`.
   - Notes: Keep method names domain-shaped. Avoid leaking Map or database mechanics into the port.
   - Verification: Typecheck will identify all implementation sites.

5. Implement in-memory repository behavior.
   - Change: Implement the new repository methods in `InMemoryMovieReservationRepository`.
   - Files/modules likely affected: `movie-reservation-service/src/infrastructure/repositories/in-memory/in-memory-movie-reservation.repository.ts`.
   - Notes: Preserve seed data. Add duplicate reservation protection for `reservationRequestId` if the processor can retry.
   - Verification: Extend `movie-reservation-service/test/integration/infrastructure/in-memory-movie-reservation.repository.test.ts` for repository-specific behavior only if the behavior is not already covered through processor tests.

6. Implement the in-process processor.
   - Change: Add the processor implementation that claims, checks conflicts, confirms/rejects/fails, and returns typed results.
   - Files/modules likely affected: `movie-reservation-service/src/application/movie-reservations/in-process-reservation-request.processor.ts`.
   - Notes: Use existing domain transition helpers instead of assigning statuses manually.
   - Verification: Processor tests cover confirmed, rejected, skipped terminal, missing/no-pending, and no duplicate reservation behavior.

7. Wire the processor through Nest composition.
   - Change: Add `RESERVATION_REQUEST_PROCESSOR` token and provider factory in the movie reservations composition module.
   - Files/modules likely affected:
     - `movie-reservation-service/src/di/movie-reservations/movie-reservation.tokens.ts`
     - `movie-reservation-service/src/di/movie-reservations/movie-reservations-composition.module.ts`
     - `movie-reservation-service/test/integration/di/movie-reservations-composition.module.test.ts`
   - Notes: Export the token so future worker entrypoints and tests can resolve the contract.
   - Verification: DI integration test resolves the processor token.

8. Add polling workflow coverage if useful.
   - Change: Optionally add an integration test proving a GraphQL-created request can be processed by the resolved processor and then polled as `CONFIRMED` or `REJECTED`.
   - Files/modules likely affected: `movie-reservation-service/test/integration/api/graphql.test.ts`.
   - Notes: Keep this deterministic. Do not sleep or wait for background work.
   - Verification: Integration test calls the processor directly between mutation and polling query.

9. Run service verification.
   - Change: Run targeted tests while iterating, then the full service check.
   - Files/modules likely affected: none.
   - Verification:
     - `npm -w movie-reservation-service test`
     - `npm -w movie-reservation-service run check`

## 13. Testing Strategy

- Domain unit tests: Existing transition tests already cover basic allowed transitions. Add only focused tests if a reservation factory or additional transition rule is introduced.
- Processor unit/application tests: Primary D5 coverage. Directly construct the processor with `InMemoryMovieReservationRepository` or a small fake if direct in-memory setup becomes noisy.
- Repository integration tests: Cover repository-specific claim/update/conflict behavior if processor tests do not make failures easy to diagnose.
- DI integration tests: Verify `MovieReservationsCompositionModule` resolves `RESERVATION_REQUEST_PROCESSOR`.
- GraphQL integration tests: Keep existing request/poll tests stable. Add one deterministic process-then-poll test only if it materially improves confidence.
- Regression cases:
  - Requested request becomes confirmed and creates a reservation.
  - Requested request becomes rejected when a selected seat is already reserved for that screening.
  - Confirmed, rejected, and failed requests are skipped without duplicate side effects.
  - Missing id or no pending request returns a skipped result.
  - Cross-screening reservations for the same seat id do not conflict unless the screening also matches.

## 14. Rollout / Migration Plan

- This is an internal service-code change with no durable data migration.
- Keep GraphQL's `requestReservation` response behavior stable: newly requested reservations still start as `REQUESTED`.
- Merge D5 behind tests only; there is no feature flag needed because no public processing endpoint is added.
- Future rollout path:
  - D6 can implement the same repository/processor behavior with Postgres and transactions.
  - D11 can add worker signaling and call the same processor contract from a worker entrypoint.
- Rollback is a git revert of the D5 branch.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| Processor logic leaks into GraphQL resolver | Medium | Low | Keep processor as application service and keep resolver behavior unchanged |
| In-memory claim semantics do not map to Postgres | High | Medium | Model claim as a single port operation that transitions `REQUESTED` to `PROCESSING` |
| Duplicate reservations are created on retry | High | Medium | Check existing reservation by `reservationRequestId` and make terminal states no-ops |
| Seat conflict logic is incomplete | High | Medium | Test same-screening conflicts and cross-screening non-conflicts |
| Timer-based processing makes tests flaky | Medium | Medium | Do not add background loops in D5; tests call processor directly |
| Repository port grows too broad | Medium | Medium | Keep method names focused; split a processing repository port if implementation becomes hard to read |
| Generated ids/timestamps make tests brittle | Low | Medium | Assert result shape and returned entities, or inject small id/clock fakes if brittleness appears |

## 16. Done Criteria

- Branch is linked to GitHub issue `#2`.
- `ReservationRequestProcessor` contract exists in the application layer.
- In-process processor implementation can be driven directly from tests.
- In-memory repository supports the required claim, update, conflict, and reservation persistence behavior.
- DI composition exports a processor provider/token.
- Tests cover confirmation, rejection due to taken seats, and idempotent terminal behavior.
- No durable queue, worker runtime, Postgres, or timer loop is introduced.
- `npm -w movie-reservation-service test` passes.
- `npm -w movie-reservation-service run check` passes.
