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

D6.1 adds a local fake in-process worker. `requestReservation(input)` still
creates a `REQUESTED` request and returns immediately, but the local worker can
claim it, briefly mark it `PROCESSING`, and then move it to `CONFIRMED` or
`REJECTED`. This is not a production worker runtime; it is a deterministic
local data-plane adapter that teaches the future control-plane/worker split
without adding a queue or a separate service yet.

One current API caveat: `screenings { seats }` returns the seats for the
screening's auditorium. It is not yet a dedicated availability query that
subtracts confirmed reservations. In the seed data, seats `66666666-6666-4666-8666-666666666661`
and `66666666-6666-4666-8666-666666666662` are already confirmed for
`88888888-8888-4888-8888-888888888881`; use `66666666-6666-4666-8666-666666666663` for the happy-path local
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
44444444-4444-4444-8444-444444444441
```

## 2. List Screenings And Seats

```graphql
query ScreeningsForMovie {
  screenings(movieId: "44444444-4444-4444-8444-444444444441") {
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
55555555-5555-4555-8555-555555555551
66666666-6666-4666-8666-666666666663
```

## 3. Request A Reservation

```graphql
mutation RequestReservation {
  requestReservation(
    input: {
      screeningId: "55555555-5555-4555-8555-555555555551"
      seatIds: ["66666666-6666-4666-8666-666666666663"]
    }
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

The local fake worker may process the request before you poll, so seeing
`CONFIRMED` quickly is also expected.

Copy the returned reservation request id, for example:

```text
9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f
```

## 4. Poll The Reservation Request

```graphql
query ReservationRequestStatus {
  reservationRequestStatus(id: "9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f") {
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
- `FAILED`: processing hit repeated unexpected internal failures after the
  small local retry budget was used. Seat conflicts are terminal `REJECTED` and
  are not retried.

## 5. Fetch The Reservation Result

After `reservationRequestStatus(id)` returns `CONFIRMED`, use the same request
id to fetch the confirmed reservation result. The local seed data includes a
confirmed request:

```graphql
query ReservationResult {
  reservationResult(requestId: "77777777-7777-4777-8777-777777777771") {
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
        "screeningId": "55555555-5555-4555-8555-555555555551",
        "seatIds": ["66666666-6666-4666-8666-666666666663"]
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
    "id": "9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f"
  }
}
```
