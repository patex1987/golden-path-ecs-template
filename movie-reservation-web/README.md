# Movie Reservation Web

React frontend for clicking through the movie reservation flow while preserving
the observability headers used by the backend.

## Run With Local Observability

From the repository root, start the backend dependencies and API:

```sh
docker compose up -d postgres
docker compose --profile observability up -d otel-collector
npm -w movie-reservation-service run db:migrate:local-postgres
npm -w movie-reservation-service run db:seed:local-postgres
docker compose --profile api up -d --build api
```

Then start the frontend:

```sh
npm -w movie-reservation-web run dev
```

Open:

```text
http://127.0.0.1:5173
```

The frontend sends GraphQL requests through Vite's `/graphql` proxy. By default
the proxy targets `http://127.0.0.1:3001`, which matches the containerized API
profile documented in `docs/workflows/local-observability.md`.

If your API runs on another port:

```sh
VITE_API_PROXY_TARGET=http://127.0.0.1:3000 npm -w movie-reservation-web run dev
```

## Demo Flow

1. Load catalog data.
2. Select a movie.
3. Pick a screening.
4. Select one or more seats.
5. Request a reservation.
6. Watch polling move the request into a terminal state.
7. Copy the correlation id, trace id, or request id from the diagnostics panel
   and search for it in Grafana/Tempo/Loki.

The current backend API returns auditorium seats, not a dedicated availability
calculation. Already-reserved seeded seats are still clickable and should become
useful rejection demos.
