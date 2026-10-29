---
name: effect-v4
description: Effect v4 (4.0.0) for TypeScript. Use when writing, reviewing, or testing Effect code — Effect.gen, Effect.fn, Schema, TaggedError, Context.Service, Layer, ManagedRuntime, Config, Scope, Fiber, Queue, Ref, Schedule, Stream, Cache, HttpClient, HttpRouter, HttpApi, SqlClient, SqlSchema, effect/ai, the Vercel AI SDK inside Effect, @effect/vitest, TestClock — or running Effect on Cloudflare Workers.
---

# Effect v4

Effect 4.0.0 is the stable release. Write v4.
Model memory and effect.website default to v3. Do not trust either.
Every example that starts with `import` compiles against `effect@4.0.0`. Blocks under **Fail review on** are wrong on purpose.

## The model

`Effect.Effect<A, E, R>` describes work. Building it runs nothing.

- `A` is the success value.
- `E` is the expected failures, as tagged errors.
- `R` is the services still required. A `Layer` provides them.

Run an Effect once, at the program edge. Everything below the edge returns an Effect.
Hover `A`, `E`, and `R`. Inference is the documentation.

## Imports

| Need                         | Import                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                         | `import { Effect, Layer, Schema, Context } from "effect"`                                                                                                            |
| HTTP client and server       | `effect/http`                                                                                                                                                        |
| HttpApi                      | `effect/http-api`                                                                                                                                                    |
| SQL                          | `effect/sql`                                                                                                                                                         |
| LLMs                         | `effect/ai`                                                                                                                                                          |
| Test services                | `effect/testing`                                                                                                                                                     |
| Everything else              | `effect/<area>`: `cli`, `rpc`, `workflow`, `cluster`, `persistence`, `reactivity`, `observability`, `encoding`, `process`, `socket`, `workers`, `eventlog`, `schema` |
| Runtimes, drivers, providers | `@effect/platform-node`, `@effect/sql-sqlite-node`, `@effect/sql-d1`, `@effect/ai-openai`, `@effect/ai-anthropic`, `@effect/vitest`                                  |

`effect/unstable/*`, `@effect/platform`, `@effect/sql`, and `@effect/ai` are prerelease paths. They do not exist in 4.0.0.

Most of `effect/<area>` is tagged `@stability unstable`. It is production code, but a 4.x minor can break it.
Pin `effect` and every `@effect/*` to one exact version. Upgrade them together.

## House rules

**Write**

1. A reusable effectful function is `Effect.fn("Owner.method")`. One-off sequencing is inline `Effect.gen`. The name is the span.
2. Pure work stays plain TypeScript. `xs.map(f)`, never `Effect.forEach(xs, (x) => Effect.succeed(f(x)))`.
3. No ambient globals in Effect code. `fetch` → `HttpClient`. `Date.now()` → `Clock` or `DateTime`. `console` → `Effect.log*`. `setTimeout` → `Effect.sleep`. `Math.random()` → `Random`.
4. Run effects only at the entry point. Never `Effect.runPromise` inside a helper.

**Errors**

5. An expected failure is a `Schema.TaggedError` class. Fail with `return yield* new ItemMissing({ id })`. Returning `{ _tag: "ItemMissing" }` is a success.
6. `_tag` is the only discriminant. Success unions use `Data.taggedEnum`. Never write `{ _tag: "X" as const }`.
7. Handle an error only where you have a real answer: a fallback, a retry, a response, a settlement. Otherwise leave it in `E`.
8. Never swallow. No `Effect.ignore`, no catch-to-void. Best-effort work returns a tagged outcome and logs it.
9. Bugs and impossible states die. Only the entry point inspects `Cause`.

**Data**

10. Decode unknown input once, at the boundary, with Schema. Do not decode values you just built.

**Services**

11. A service owns I/O, state, credentials, or policy. Everything else is a function.
12. Yield dependencies once in `Layer.effect` and close over them. Public methods have `R = never`.
13. Service keys are path-shaped and unique: `"@app/store/ItemStore"`.
14. Provide shared infrastructure once, at the composition root: HTTP transport, SQL driver, logger.

**Config**

15. Read env and host bindings only at the entry point. Pass plain typed values into layer constructors: `catalogLayer({ baseUrl, apiKey })`.
16. Every setting is required. No `??` fallbacks. No `Config.withDefault` for business constants. Keep constants in one config module.

**Retry**

17. One retry owner per failure. Bound every retry with `times` and a schedule. Set SDK retries to zero when Effect retries.

**Testing**

18. No module mocks. No fake services. No stubbed `HttpClient`. Test pure functions, recorded fixtures through the production schema, and real local engines (SQLite `:memory:`, temp directories) with `TestClock`.
19. Prove a workflow change with the project's real end-to-end run. Show the output.

**Style**

20. No comments on functions. Names and types are the docs.

## Choose

| I need                                                          | Use                                                    | Read                                         |
| --------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| Sequence effects                                                | `Effect.gen` + `yield*`                                | [core](references/core.md)                   |
| A named, traced operation                                       | `Effect.fn("X.y")`                                     | [core](references/core.md)                   |
| A value that may be absent                                      | `Option`                                               | [core](references/core.md)                   |
| A success-or-failure value, not an effect                       | `Result`                                               | [core](references/core.md)                   |
| Exhaustive branching on a union                                 | `Match`, `$match`                                      | [core](references/core.md)                   |
| Durations and dates                                             | `Duration`, `DateTime`                                 | [core](references/core.md)                   |
| A typed expected failure                                        | `Schema.TaggedError`                                   | [errors](references/errors.md)               |
| Recover from one failure                                        | `catchTag`, `catchTags`, `catchReason`                 | [errors](references/errors.md)               |
| Wrap a Promise or SDK call                                      | `Effect.tryPromise`                                    | [errors](references/errors.md)               |
| Validate unknown input                                          | `Schema.decodeUnknownEffect`                           | [schema](references/schema.md)               |
| Parse JSON text                                                 | `Schema.fromJsonString`                                | [schema](references/schema.md)               |
| A dependency or capability                                      | `Context.Service` + `Layer`                            | [services](references/services.md)           |
| Settings and secrets                                            | `Config`, `Redacted` at the entry                      | [services](references/services.md)           |
| Start the program                                               | `NodeRuntime.runMain`, `ManagedRuntime`                | [services](references/services.md)           |
| Do work in parallel                                             | `Effect.forEach(xs, f, { concurrency })`, `Effect.all` | [concurrency](references/concurrency.md)     |
| Open and close a resource                                       | `Effect.acquireRelease`, `Scope`                       | [concurrency](references/concurrency.md)     |
| A background loop                                               | `Effect.forkScoped` in a layer                         | [concurrency](references/concurrency.md)     |
| Shared mutable state                                            | `Ref`, `SynchronizedRef`, `SubscriptionRef`            | [concurrency](references/concurrency.md)     |
| Wait for a signal, limit access                                 | `Deferred`, `Latch`, `Semaphore`                       | [concurrency](references/concurrency.md)     |
| A work queue or fan-out                                         | `Queue`, `PubSub`                                      | [concurrency](references/concurrency.md)     |
| Retry, repeat, poll                                             | `Effect.retry`, `Effect.repeat`, `Schedule`            | [time](references/time.md)                   |
| A deadline                                                      | `Effect.timeoutOrElse`                                 | [time](references/time.md)                   |
| Values over time, pagination, SSE                               | `Stream`                                               | [streams](references/streams.md)             |
| Memoize a lookup                                                | `Cache`, `Effect.cachedWithTTL`                        | [caching](references/caching.md)             |
| Batch many lookups into one call                                | `Request`, `RequestResolver`                           | [caching](references/caching.md)             |
| Logs, spans, metrics                                            | `Effect.log*`, `Effect.fn`, `Metric`                   | [observability](references/observability.md) |
| Call an HTTP API                                                | `HttpClient`                                           | [http](references/http.md)                   |
| Serve HTTP                                                      | `HttpRouter`, `HttpApi`                                | [http](references/http.md)                   |
| Query SQL                                                       | `SqlClient`, `SqlSchema`                               | [sql](references/sql.md)                     |
| Call an LLM                                                     | Vercel AI SDK or `effect/ai`                           | [llm](references/llm.md)                     |
| Files, paths, child processes, CLIs                             | `FileSystem`, `Path`, `ChildProcess`, `effect/cli`     | [platform](references/platform.md)           |
| Write a test                                                    | `@effect/vitest`, `TestClock`                          | [testing](references/testing.md)             |
| RPC, durable workflows, cluster, persistence, atoms, event logs | —                                                      | [modules](references/modules.md)             |
| You wrote a v3 or prerelease name                               | —                                                      | [v3 traps](references/v3-traps.md)           |
| Cloudflare Workers                                              | —                                                      | [cloudflare](references/cloudflare.md)       |

## Verify an API

Do not guess a signature. The installed package ships its source and docs:

- `node_modules/effect/src/<Module>.ts`, or `src/<area>/` for subpaths. Exports carry **When to use** and **Gotchas** JSDoc.
- `node_modules/effect/ai-docs/src/` holds the official examples by topic.
- `node_modules/effect/AGENTS.md` is the upstream agent guide.

With pnpm, look under the package that depends on `effect`: `<package>/node_modules/effect`.
`rg` smart case makes lowercase patterns case-insensitive. Search with `rg -s`.
The Effect language service (`@effect/tsgo`) reports v3 names as `outdatedApi`. Run the typecheck.

## Cloudflare Workers

Effect runs on Workers with no platform package.
Build the layer graph per invocation from `env`. Use `FetchHttpClient.layer` and `@effect/sql-d1`.
D1 has no transactions. Use `batch([...])` on the `D1Client` service.
Read [cloudflare](references/cloudflare.md) only for Workers work. Nothing else in this skill depends on it.

## Review

- Hover `R`. A service in `R` that no layer provides defects at run time → reject.
- Hover `E`. A new error class with no `catchTag` update means an exhaustive edge is lying.
- `Effect.forEach` whose callback only wraps a pure value → reject. That is `xs.map`.
- `{ _tag: "X" as const }` → reject. Use a constructor.
- `yield*` of a service inside a public method → reject. Capture it in the layer.
- Global `fetch` inside `tryPromise` for an HTTP API → reject. Use `HttpClient`.
- `Effect.ignore`, `catchCause`, or a handler returning `Effect.void` below the entry → reject.
- A retry without `times` → reject. It retries forever.
- `Cache.make` without `timeToLive` → reject. It caches failures forever.
- `vi.mock`, `Layer.mock`, `Layer.succeed` of an app service, or `HttpClient.make` in a test → reject.

## Provenance

A copy of this skill also lives in a work repository. Update both copies when either changes.
