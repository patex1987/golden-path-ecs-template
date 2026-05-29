# GraphQL Reservation Query Examples

This is a quick local workflow for trying the movie reservation API through
GraphiQL, curl, or Postman.

The story is:

1. You want to see a movie.
2. You list the movies available for your movie provider.
3. You choose a movie and inspect its screenings.
4. You pick seats from the screening's seat list.
5. You submit a reservation request.
6. You poll the reservation request status.
7. When internal processing has run, you can inspect the confirmed reservation.

## Start The Service

From the repository root:

```sh
npm -w movie-reservation-service run dev
```

The local fixed-user profile listens on `http://localhost:3000` and accepts
GraphQL requests without a bearer token. Open GraphiQL at:

```text
http://localhost:3000/graphql
```

## Important Vocabulary

- `ReservationRequest` is the async command/status object created when a user
  asks to reserve seats.
- `Reservation` is the final confirmed booking result after processing
  succeeds.
- `reservationRequestStatus(id)` fetches the command/status object for polling.
- `reservationResult(requestId)` fetches the final booking result by the same
  request id after the request is confirmed.

D5 intentionally does not add a timer, queue, background worker process, or
public GraphQL mutation to process work. `requestReservation(input)` creates a
`REQUESTED` request and returns immediately. The in-process processor exists as
an internal application contract, and tests call `processNextPendingRequest()`
directly. If you only use GraphiQL, curl, or Postman against the running local
service, a newly created request will remain `REQUESTED` until some internal
code invokes the processor.

One current API caveat: `screenings { seats }` returns the seats for the
screening's auditorium. It is not yet a dedicated availability query that
subtracts confirmed reservations. In the seed data, seats `seat-aurora-1-a1`
and `seat-aurora-1-a2` are already confirmed for
`reservation-aurora-ada`; use `seat-aurora-1-a3` for the happy-path local
example.

## 1. List Movies

```graphql
query Movies {
  movies {
    id
    title
    rating
    durationMinutes
  }
}
```

Useful local seed value:

```text
movie-aurora-1
```

## 2. List Screenings And Seats

```graphql
query ScreeningsForMovie {
  screenings(movieId: "movie-aurora-1") {
    id
    movieId
    auditoriumId
    startsAt
    endsAt
    seats {
      id
      row
      number
    }
  }
}
```

Useful local seed values:

```text
screening-aurora-1
seat-aurora-1-a3
```

## 3. Request A Reservation

```graphql
mutation RequestReservation {
  requestReservation(
    input: { screeningId: "screening-aurora-1", seatIds: ["seat-aurora-1-a3"] }
  ) {
    id
    screeningId
    seatIds
    requestedByUserId
    status
  }
}
```

Expected status immediately after the mutation:

```text
REQUESTED
```

Copy the returned reservation request id, for example:

```text
request-846292b1-7e14-4445-a79c-35b894c57f8b
```

## 4. Poll The Reservation Request

```graphql
query ReservationRequestStatus {
  reservationRequestStatus(id: "request-846292b1-7e14-4445-a79c-35b894c57f8b") {
    id
    requestedByUserId
    screeningId
    seatIds
    status
  }
}
```

Possible statuses:

- `REQUESTED`: accepted by the API and waiting for processing.
- `PROCESSING`: claimed by the processor.
- `CONFIRMED`: processing succeeded and a confirmed reservation was created.
- `REJECTED`: processing completed, but the requested seats conflicted with an
  existing confirmed reservation.
- `FAILED`: processing hit an unexpected internal failure. In D5 this is terminal and is not retried automatically; later durable worker phases should add retry policy and operator-facing failure handling.

## 5. Fetch The Reservation Result

After `reservationRequestStatus(id)` returns `CONFIRMED`, use the same request
id to fetch the confirmed reservation result. The local seed data includes a
confirmed request:

```graphql
query ReservationResult {
  reservationResult(requestId: "request-aurora-ada") {
    id
    reservationRequestId
    screeningId
    seatIds
    reservedByUserId
    confirmedAt
  }
}
```

This query is for final bookings. It is separate from
`reservationRequestStatus(id)` because polling command status and reading
confirmed booking state are different use cases.

## curl Example

```sh
curl -s http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"query Movies { movies { id title rating durationMinutes } }"}'
```

For multi-line operations, put the GraphQL document in the `query` JSON field
and variables in the `variables` field:

```sh
curl -s http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -d '{
    "query": "mutation RequestReservation($input: RequestReservationInput!) { requestReservation(input: $input) { id status screeningId seatIds } }",
    "variables": {
      "input": {
        "screeningId": "screening-aurora-1",
        "seatIds": ["seat-aurora-1-a3"]
      }
    }
  }'
```

## Postman Example

Use a `POST` request to:

```text
http://localhost:3000/graphql
```

Headers:

```text
content-type: application/json
```

Body type: raw JSON

```json
{
  "query": "query ReservationRequestStatus($id: ID!) { reservationRequestStatus(id: $id) { id screeningId seatIds requestedByUserId status } }",
  "variables": {
    "id": "request-846292b1-7e14-4445-a79c-35b894c57f8b"
  }
}
```
