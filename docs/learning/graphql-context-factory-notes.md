# GraphQL Context Factory Notes

This note explains the small TypeScript pattern used by the GraphQL context
factory in the movie reservation service.

## Runtime Flow

The GraphQL context is created from the HTTP request after authentication
middleware has enriched that request.

```text
incoming HTTP request
  -> GraphQL authentication middleware
  -> request.authenticatedUser and request.actor are attached
  -> Apollo context factory reads the request
  -> resolver receives MovieReservationGraphqlContext
```

The important design choice is that resolvers do not parse tokens or build actor
context themselves. They receive already-authenticated context.

## Concise Form

The current context factory uses a concise arrow function:

```ts
const gqlContext = ({
  req,
}: {
  req: GraphqlHttpRequest;
}): MovieReservationGraphqlContext => ({
  req,
  authenticatedUser: requireAuthenticatedUser(req),
  actor: requireActor(req),
});
```

This destructures `req` from Apollo's context factory input and immediately
returns the GraphQL context object.

In Python terms, this is similar to receiving a dictionary-like request wrapper,
pulling out `req`, and returning another dictionary-like object. The TypeScript
interfaces document the expected shape, but the runtime value is still a normal
JavaScript object.

## Long Form Equivalent

The concise form is equivalent to this longer version:

```ts
const gqlContext = (input: {
  req: GraphqlHttpRequest;
}): MovieReservationGraphqlContext => {
  const req = input.req;
  const authenticatedUser = requireAuthenticatedUser(req);
  const actor = requireActor(req);

  return {
    req,
    authenticatedUser,
    actor,
  };
};
```

The long form is sometimes easier while learning because it makes each temporary
value explicit. The concise form is fine once the flow is clear.

## Fail Early

The helper functions intentionally throw when middleware did not attach the
expected request context:

```ts
function requireActor(req: GraphqlHttpRequest): ActorContext {
  if (req.actor === undefined) {
    throw new Error("GraphQL actor context was not initialized");
  }

  return req.actor;
}
```

That is the same fail-early idea used in Python services: if request setup is
broken, the application should fail at the boundary instead of letting resolvers
run with missing business context.

## Ownership

The context factory should stay small.

- Middleware authenticates the request and attaches identity/context.
- The context factory exposes that request context to Apollo resolvers.
- Resolvers read context and call application use cases.
- Application services decide business behavior.

If context creation starts doing token parsing, tenant lookup, policy decisions,
or logging setup directly, those responsibilities should be moved back into
middleware, application services, or observability hooks.
