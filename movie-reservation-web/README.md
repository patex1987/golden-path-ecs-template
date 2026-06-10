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
mkdir -p movie-reservation-web/env_files/local
cp movie-reservation-web/env_files/templates/local/local-dev.env.template movie-reservation-web/env_files/local/local-dev.env
npm -w movie-reservation-web run dev
```

Open:

```text
http://127.0.0.1:5173
```

The frontend sends GraphQL requests through Vite's `/graphql` proxy. By default
the proxy targets `http://127.0.0.1:3001`, which matches the containerized API
profile documented in `docs/workflows/local-observability.md`.

The agent panel sends demo agent requests through Vite's `/api/v1/demo` proxy.
By default that proxy targets `http://127.0.0.1:8081`, the Docker-exposed
`movie-agent-worker` service from `/home/patex1987/development/python-agent-with-idp`.

The frontend dev script loads
`movie-reservation-web/env_files/local/local-dev.env`. Edit that rendered file
if your API or agent runs on another port:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:3000
VITE_AGENT_PROXY_TARGET=http://127.0.0.1:8081
```

Optional local-only settings:

- `VITE_GRAPHQL_URL` overrides the browser GraphQL endpoint. Leave it unset to
  use the Vite `/graphql` proxy.
- `VITE_AGENT_URL` overrides the browser agent endpoint. Leave it unset to use
  the Vite `/api/v1/demo` proxy.
- `VITE_DEMO_BEARER_TOKEN` sends a local demo bearer token with GraphQL
  requests while running the Vite dev server. `VITE_*` values are visible to
  browser code, so this value is not a secret. Local fixed-user backend profiles
  do not need it. Local JWT profiles can use a JWT-shaped value that the backend
  decodes without production signature, issuer, audience, expiry, or JWKS
  validation. Production-shaped auth should use a later OIDC flow, not this env
  value.

## Demo Flow

1. Load catalog data.
2. Select a movie.
3. Pick a screening.
4. Select one or more seats.
5. Request a reservation.
6. Watch polling move the request into a terminal state.
7. Use the agent panel prompt chips to run the happy, slow, or failing
   recommendation workflow through the Python agent and both MCP servers.
8. Copy the correlation boundary id from the agent panel, then search for the
   workflow in Grafana/Tempo/Loki.

The seat map marks confirmed seats as blocked. In the local seed data, seats A1
and A2 for the Type-Safe Matinee screening are already confirmed, while A3 is
available for the happy-path demo.
