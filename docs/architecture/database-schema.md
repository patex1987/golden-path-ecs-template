# Movie Reservation Database Schema

The source of truth for this schema is the Knex migration in
`movie-reservation-service/src/infrastructure/database/migrations/202605290001_create_movie_reservation_schema.ts`.
This document is a human-readable map of the current table relationships.

In production systems, documenting database tables and relationships is common
when the schema carries important business meaning or operational behavior. The
documentation should not replace migrations, database constraints, or generated
schema inspection. It should explain the relationships that matter to humans:
ownership boundaries, workflow tables, important uniqueness constraints, and
the reason a table exists.

For this service, the documentation is useful because the database is not only
storing entities. It also stores the reservation request workflow, worker claim
state, retry counters, processing attempts, and the seat-conflict guard that
prevents two confirmed reservations from taking the same seat for the same
screening.

## Relationship Diagram

```mermaid
erDiagram
    MOVIE_PROVIDERS {
        uuid id PK
        text code UK
        text name
    }

    MOVIES {
        uuid id PK
        uuid movie_provider_id FK
        text title
        text rating
        int duration_minutes
    }

    AUDITORIUMS {
        uuid id PK
        uuid movie_provider_id FK
        text name
    }

    SCREENINGS {
        uuid id PK
        uuid movie_provider_id FK
        uuid movie_id FK
        uuid auditorium_id FK
        timestamptz starts_at
        timestamptz ends_at
    }

    SEATS {
        uuid id PK
        uuid movie_provider_id FK
        uuid auditorium_id FK
        text row_label
        int seat_number
    }

    RESERVATION_REQUESTS {
        uuid id PK
        bigint sequence UK
        uuid movie_provider_id FK
        uuid screening_id FK
        text requested_by_user_id
        text status
        timestamptz requested_at
        text claimed_by
        text claim_token
        timestamptz claimed_at
        timestamptz claim_expires_at
        timestamptz last_heartbeat_at
        int lease_timeout_count
        int transient_failure_count
        timestamptz processed_at
        timestamptz updated_at
    }

    RESERVATION_REQUEST_SEATS {
        uuid reservation_request_id PK,FK
        uuid seat_id PK,FK
        uuid movie_provider_id FK
        uuid screening_id FK
        uuid auditorium_id FK
    }

    RESERVATIONS {
        uuid id PK
        uuid movie_provider_id FK
        uuid reservation_request_id UK,FK
        uuid screening_id FK
        text reserved_by_user_id
        timestamptz confirmed_at
    }

    RESERVATION_SEATS {
        uuid reservation_id PK,FK
        uuid seat_id PK,FK
        uuid movie_provider_id FK
        uuid screening_id FK
        uuid auditorium_id FK
    }

    RESERVATION_REQUEST_PROCESSING_ATTEMPTS {
        bigint id PK
        uuid reservation_request_id FK
        bigint reservation_request_sequence
        timestamptz started_at
        timestamptz completed_at
        text outcome
        text reason
        uuid reservation_id FK
        uuid conflicting_reservation_id FK
    }

    MOVIE_PROVIDERS ||--o{ MOVIES : owns
    MOVIE_PROVIDERS ||--o{ AUDITORIUMS : owns
    MOVIE_PROVIDERS ||--o{ SCREENINGS : owns
    MOVIE_PROVIDERS ||--o{ SEATS : owns
    MOVIE_PROVIDERS ||--o{ RESERVATION_REQUESTS : owns
    MOVIE_PROVIDERS ||--o{ RESERVATIONS : owns

    MOVIES ||--o{ SCREENINGS : scheduled_as
    AUDITORIUMS ||--o{ SCREENINGS : hosts
    AUDITORIUMS ||--o{ SEATS : contains

    SCREENINGS ||--o{ RESERVATION_REQUESTS : receives
    RESERVATION_REQUESTS ||--o{ RESERVATION_REQUEST_SEATS : asks_for
    SCREENINGS ||--o{ RESERVATION_REQUEST_SEATS : scopes
    SEATS ||--o{ RESERVATION_REQUEST_SEATS : requested

    RESERVATION_REQUESTS ||--o| RESERVATIONS : produces
    RESERVATIONS ||--o{ RESERVATION_SEATS : confirms
    SCREENINGS ||--o{ RESERVATION_SEATS : scopes
    SEATS ||--o{ RESERVATION_SEATS : reserved

    RESERVATION_REQUESTS ||--o{ RESERVATION_REQUEST_PROCESSING_ATTEMPTS : records
    RESERVATIONS |o--o{ RESERVATION_REQUEST_PROCESSING_ATTEMPTS : referenced_by
```

## Notes

- `movie_provider_id` is the current tenant boundary. Many relationships use
  composite foreign keys that include `movie_provider_id` so records cannot
  accidentally connect across providers.
- `reservation_request_seats` captures the seats a user asked for before the
  request is processed.
- `reservations.reservation_request_id` is unique, so a reservation request can
  produce at most one confirmed reservation.
- `reservation_seats` has a unique constraint on `(screening_id, seat_id)`.
  That is the database-level guard against double-booking a confirmed seat for
  the same screening.
- `reservation_request_processing_attempts` is operational history. It records
  worker outcomes and can reference either the confirmed reservation or the
  conflicting reservation that caused a rejection.
