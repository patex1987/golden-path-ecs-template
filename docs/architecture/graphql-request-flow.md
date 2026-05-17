# GraphQL Request Flow

This note shows how a GraphQL request moves through the current
`movie-reservation-service/` codebase.

The important mental model is:

- NestJS and Apollo own the transport/framework path.
- The resolver is the presentation boundary.
- The resolver calls application services.
- Application services coordinate domain rules and infrastructure ports.
- Infrastructure adapters implement those ports.

## Current Request Sequence

This is the current happy path for a GraphQL request such as `query { me { id } }`.

```mermaid
sequenceDiagram
  autonumber
  actor Client as GraphQL client
  participant Nest as Nest application
  participant Middleware as GraphqlAuthenticationMiddleware
  participant AuthService as AuthenticationService
  participant AuthManager as AuthenticationManager
  participant Apollo as Apollo GraphQL handler
  participant ContextFactory as AppModule context function
  participant Resolver as MovieReservationsResolver
  participant Mapper as GraphQL mapper

  Client->>Nest: POST /graphql
  Nest->>Middleware: use(req, res, next)
  Middleware->>Middleware: extract bearer token from req.headers
  Middleware->>AuthService: authenticateJwtToken(token)
  AuthService->>AuthManager: authenticateJwtToken(token)
  AuthManager-->>AuthService: AuthenticatedUser
  AuthService-->>Middleware: ActorContext
  Middleware->>Middleware: req.actor = actor
  Middleware->>Apollo: next()
  Apollo->>ContextFactory: context({ req })
  ContextFactory->>ContextFactory: requireActor(req)
  ContextFactory-->>Apollo: { req, actor }
  Apollo->>Resolver: me(@Context() context)
  Resolver->>Mapper: toAuthenticatedUserGql(context.actor)
  Mapper-->>Resolver: AuthenticatedUserGql
  Resolver-->>Apollo: AuthenticatedUserGql
  Apollo-->>Client: GraphQL response
```

Current code anchors:

- `src/app.ts` creates the Nest application.
- `src/app.module.ts` registers `GraphQLModule.forRoot(...)` and the GraphQL
  `context` function.
- `src/presentation/graphql/movie-reservations-graphql.module.ts` applies
  `GraphqlAuthenticationMiddleware` to the `graphql` route.
- `src/presentation/graphql/graphql-authentication.middleware.ts` reads the
  bearer token and attaches `req.actor`.
- `src/presentation/graphql/graphql-context.ts` defines the request and GraphQL
  context shapes.
- `src/presentation/graphql/movie-reservations.resolver.ts` receives the context
  through `@Context()`.

## Authentication Branches

The middleware does not authenticate the request by itself. It delegates to the
application authentication service, and that service delegates to the configured
authentication manager.

```mermaid
sequenceDiagram
  autonumber
  participant Middleware as GraphqlAuthenticationMiddleware
  participant AuthService as AuthenticationService
  participant Manager as AuthenticationManager
  participant TokenClient as TokenValidationClient
  participant Request as GraphqlHttpRequest
  participant Response as HTTP response

  Middleware->>AuthService: authenticateJwtToken(token)
  AuthService->>Manager: authenticateJwtToken(token)

  alt authMode is local-fixed-user
    Manager-->>AuthService: fixed AuthenticatedUser
    AuthService-->>Middleware: ActorContext
    Middleware->>Request: attach actor to req.actor
  else authMode is local-jwt
    Manager->>TokenClient: validate token
    TokenClient-->>Manager: token claims
    Manager-->>AuthService: AuthenticatedUser
    AuthService-->>Middleware: ActorContext
    Middleware->>Request: attach actor to req.actor
  else authentication fails
    Manager--x AuthService: AuthenticationError
    AuthService--x Middleware: AuthenticationError
    Middleware->>Response: status(401).json(...)
  end
```

The key learning point: TypeScript says `req.actor` may exist, but only runtime
code can actually put the actor there. The middleware is the runtime step that
does it.

## Framework Extension Sequence

The service is intentionally small right now. This diagram shows the current
path plus the likely places where framework-side behavior can be added later.

```mermaid
sequenceDiagram
  autonumber
  actor Client as GraphQL client
  participant Middleware as Nest middleware
  participant Apollo as Apollo GraphQL execution
  participant ContextFactory as GraphQL context factory
  participant Guard as Future guard
  participant Pipe as Future pipe
  participant Interceptor as Future interceptor
  participant Resolver as Resolver method
  participant FieldResolver as Future field resolver
  participant Filter as Future exception filter

  Client->>Middleware: POST /graphql
  Middleware->>Apollo: next()
  Apollo->>ContextFactory: build context for this request
  ContextFactory-->>Apollo: context

  Apollo->>Guard: canActivate(context)
  Guard-->>Apollo: allowed
  Apollo->>Pipe: transform and validate args
  Pipe-->>Apollo: typed resolver args
  Apollo->>Interceptor: before resolver
  Interceptor->>Resolver: call resolver
  Resolver-->>Interceptor: result
  Interceptor-->>Apollo: mapped or observed result
  Apollo->>FieldResolver: resolve nested fields if needed
  FieldResolver-->>Apollo: field values
  Apollo-->>Client: GraphQL response

  alt guard, pipe, interceptor, or resolver throws
    Apollo->>Filter: map exception
    Filter-->>Client: GraphQL error response
  end
```

Current status of those extension points:

- Middleware exists today for authentication.
- The GraphQL context factory exists today and copies `req.actor` into
  resolver-friendly context.
- Guards, pipes, interceptors, exception filters, and field middleware are shown
  as future extension points. They are not part of the current request path yet.

## Context Function

In `AppModule`, the context function is registered with Apollo through Nest:

```ts
context: ({ req }: { req: GraphqlHttpRequest }): MovieReservationGraphqlContext => ({
  req,
  actor: requireActor(req),
}),
```

Apollo calls that function while handling each GraphQL request. Conceptually, it
is similar to:

```ts
const context = gqlContext({ req: incomingHttpRequest });
```

That means:

- The input object must have a `req` property.
- `req` is typed as `GraphqlHttpRequest`.
- The middleware must already have attached `req.actor`.
- `requireActor(req)` is a runtime guard. If `req.actor` is missing, the request
  fails instead of silently creating an invalid context.
- The returned `MovieReservationGraphqlContext` is what resolvers receive through
  `@Context()`.

This is similar in spirit to a Strawberry/FastAPI `context_getter`: it builds a
per-request context object that GraphQL resolvers can use.

## Clean Architecture Business Sequence

This is the shape business requests should follow after Apollo has selected the
resolver. The current `me` query only maps `context.actor`, but movie and
reservation operations should flow through the application layer like this.

```mermaid
sequenceDiagram
  autonumber
  participant Resolver as GraphQL resolver
  participant InputMapper as Input mapper
  participant AppService as MovieReservationsService
  participant Authz as AuthorizationService
  participant RepoPort as MovieReservationRepository port
  participant Repo as InMemoryMovieReservationRepository
  participant Domain as Domain objects
  participant OutputMapper as Output mapper

  Resolver->>InputMapper: map GraphQL input to application input
  InputMapper-->>Resolver: application input
  Resolver->>AppService: execute use case with actor and input
  AppService->>RepoPort: load domain data
  RepoPort->>Repo: adapter implementation call
  Repo-->>RepoPort: domain objects
  RepoPort-->>AppService: domain objects
  AppService->>Authz: check actor permission
  Authz-->>AppService: allowed or denied

  alt allowed
    AppService->>Domain: apply business rules
    Domain-->>AppService: business result
    AppService-->>Resolver: application result
    Resolver->>OutputMapper: map to GraphQL model
    OutputMapper-->>Resolver: GraphQL model
  else denied or not found
    AppService-->>Resolver: null or application error
  end
```

The outer layers are allowed to know about inner layers. Inner layers should not
know about NestJS, Apollo, HTTP, databases, or queues.

In practice:

- Presentation code translates GraphQL details into application calls.
- Application code coordinates use cases and ports.
- Domain code holds business concepts and rules.
- Infrastructure code implements application ports.
- DI composition decides which infrastructure implementation is plugged in.

## Reading The Flow In Practice

For a request like:

```graphql
query {
  me {
    id
    roles
  }
}
```

The current path is:

1. The client sends `POST /graphql`.
2. Nest runs `GraphqlAuthenticationMiddleware` for the `graphql` route.
3. The middleware extracts the bearer token and calls `AuthenticationService`.
4. `AuthenticationService` delegates to the configured authentication manager.
5. The middleware stores the result on `req.actor`.
6. Apollo calls the configured context function.
7. The context function returns `{ req, actor }`.
8. `MovieReservationsResolver.me()` receives that context through `@Context()`.
9. The resolver maps `context.actor` to the GraphQL response model.

As more business operations are added, step 9 should stay thin: the resolver
should map GraphQL input, call an application service, then map the application
result back to GraphQL output.
