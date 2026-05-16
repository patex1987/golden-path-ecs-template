Task 1: Verify `/health` endpoint (20 min) - Returns `{"status":"ok"}` ✓
Task 2: Add `/ready` endpoint (20 min) - Same pattern, add timestamp field
Task 3: Add `/bookings/:id` with TypeScript types (40 min) - Practice type safety
Task 4: Update learning notes (10 min) - Record what was learned


Perfect. Updated and synced. Now let me teach the 15-minute concepts using your actual files.

---

## Concept 1: Why Health Endpoints Exist

**The misconception**: `/health` is just another route that returns data.

**The reality**: `/health` is an **observability signal**, not application logic. Think of it like Python's `__repr__` or Rust's `Debug` trait—they're not part of your business logic, they're about letting the system introspect itself.

### Why servers need this:

In production (AWS ECS, Kubernetes, etc.), orchestrators need to ask: **"Is this instance alive and ready to receive traffic?"**

Without `/health`, the orchestrator has only two options:
1. Blindly send requests and hope (causes cascading failures)
2. Assume instances are dead → constant restarts

With `/health`, orchestrators can:
- **Detection**: Notice when an instance is unhealthy before it breaks
- **Recovery**: Automatically route traffic away or restart it
- **Deployment**: Know when new versions are stable before marking the deployment done

### Why two endpoints?

You'll build both `/health` and `/ready` because they answer different questions:

| Endpoint | Question | Answer means |
|----------|----------|--------------|
| `/health` | Is the process running? | "yes, I'm alive and listening" |
| `/ready` | Can I process requests? | "yes, database is connected, cache is warm" |

**Analogy from Python/Rust**: If your service is a database connection pool:
- `/health` = "is the Python process alive?" (always true if you're responding)
- `/ready` = "has the connection pool got open connections?" (could be false even if process is alive)

---

## Concept 2: Config vs Business Logic vs Transport

**The misconception**: Everything lives in one file (`app.ts`).

**The reality**: As your app grows, three concerns tangle together if you're not careful:

1. **Config (`.ts`)** — "Where do I get settings from?"
   - Environment variables, default values, secrets
   - *Responsible to*: the server startup process
   - Example: `PORT`, `DB_HOST`, `LOG_LEVEL`

2. **Business Logic** — "What does the request mean and how do I respond?"
   - Routes that do real work, type definitions, validation
   - *Responsible to*: the product requirements
   - Example: checking a booking status, validating an order

3. **Transport (`index.ts`)** — "How do I start the HTTP server?"
   - Framework setup (Fastify/Express), listener startup, signal handling
   - *Responsible to*: the operating system, process lifecycle
   - Example: `app.listen()`, `process.on('SIGTERM')`

### Why separate them?

In Python, you might structure a CLI tool like this:
```python
# config.py
PORT = os.getenv('PORT', '3000')

# business.py
def get_booking(booking_id: str) -> dict:
    # actual logic

# main.py
if __name__ == '__main__':
    app.run(port=int(config.PORT))
```

TypeScript has the same need. As you add features:
- Testing becomes easier (mock config independently)
- Local dev vs staging vs production configs don't interfere
- Routes don't accidentally reach into environment variables
- Your IDE can type-check each concern separately

### Your file structure (starting now):

```
service/src/
  config.ts       → PORT, environment settings, defaults
  app.ts          → routes, types, business logic (the Fastify instance)
  index.ts        → startup, listen(), signal handling
```

This isn't rigid dogma—but it means:
- You can test `app.ts` without touching `index.ts`
- You can change ports without touching route logic
- New developers read `index.ts` and immediately understand the lifecycle

---

## Your starting point: What's already there

Your `package.json` has Fastify (the HTTP framework) and Zod (for type validation). When you build `/health`, you're building:

1. A transport concern (HTTP GET response) 
2. A config concern (what port to listen on?)
3. A tiny bit of observability logic (status: "ok")

All three things, in a small endpoint. Once you see that, building `/ready` and `/bookings` will be pattern recognition + adding business logic.

---

## Ready to start coding?

Your 1.5-hour plan can now happen with clear intent:
- **Task 1** (`/health`): "I'm building an observability signal, using all three concerns"
- **Task 2** (`/ready`): "Same pattern, different semantic meaning"
- **Task 3** (`/bookings/:id`): "Now the business logic part gets interesting—this is where TypeScript types protect me"

Shall I help you start Task 1, or do you have questions about these concepts first?