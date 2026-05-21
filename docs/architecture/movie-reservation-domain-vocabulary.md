# Movie Reservation Domain Vocabulary

This document defines the shared language for the movie reservation service.
The terms are intentionally concrete so code, GraphQL schema, tests, and future
database tables use the same mental model.

## Core Terms

### Movie Provider

A `MovieProvider` is the tenant-like owner of movie reservation data.

Examples:

- a cinema chain
- a local cinema operator
- a demo tenant in local seed data

Movies, auditoriums, screenings, seats, reservation requests, and reservations
belong to a movie provider. In application code, `movieProviderId` is the
tenant boundary and should come from the authenticated actor, not normal client
input.

### Movie

A `Movie` is the title and metadata that a movie provider can schedule.

Current fields include title, rating, and duration. A movie by itself is not a
showing. It becomes bookable only when it is attached to a screening.

### Auditorium

An `Auditorium` is a physical room owned by a movie provider.

It is the place where a screening happens. Seats belong to an auditorium, not
directly to a movie.

### Screen

`Screen` is a common cinema word, but the current code does not model it as a
separate entity.

For now, when we say "screen" casually, we usually mean the auditorium or room.
If the domain later needs projector/screen hardware, screen size, format, or
premium screen types, we can add a separate `Screen` concept deliberately.

### Screening

A `Screening` is a scheduled showing of one movie in one auditorium during a
specific time window.

It connects:

- movie provider
- movie
- auditorium
- start time
- end time

This is the object users browse when choosing when to watch a movie.

### Seat

A `Seat` is a reservable position inside an auditorium.

In the current model, a seat has a row and number. During reservation flows, a
seat becomes meaningful together with a screening: reserving seat `A1` means
reserving that auditorium seat for a specific screening.

### Reservation Request

A `ReservationRequest` is the user's intent to reserve one or more seats for a
screening.

It exists before the system has produced the final confirmed reservation. This
supports an asynchronous workflow:

```text
client asks to reserve seats
service creates ReservationRequest in REQUESTED state
client polls reservationRequest(id)
processor later confirms, rejects, or fails the request
```

The request owns workflow status such as `REQUESTED`, `PROCESSING`,
`CONFIRMED`, `REJECTED`, and `FAILED`.

### Reservation

A `Reservation` is the durable confirmed result of a successful reservation
request.

It represents that specific seats are reserved for a specific screening by a
specific user. Future durable persistence must prevent two confirmed
reservations from claiming the same seat for the same screening.

## Relationship Summary

```text
MovieProvider
  owns Movies
  owns Auditoriums
  owns Screenings
  owns ReservationRequests
  owns Reservations

Auditorium
  contains Seats

Screening
  schedules one Movie
  happens in one Auditorium
  has a time window

ReservationRequest
  asks for Seats on one Screening
  has workflow status

Reservation
  confirms Seats on one Screening
  is produced from a successful ReservationRequest
```

## Naming Guidance

- Use `movieProviderId` for tenant/provider scope in service code.
- Use `Auditorium` for the room concept.
- Avoid adding `Screen` as a code type until the domain needs a separate screen
  concept.
- Use `Screening` for a scheduled showing.
- Use `ReservationRequest` for the command/status object.
- Use `Reservation` for the confirmed result.
