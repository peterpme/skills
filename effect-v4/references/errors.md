# Errors

Typed failures, defects, interruption, and recovery.

## Pick

| Situation                              | Write                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| An expected failure                    | A `Schema.TaggedError` class. `return yield* new ItemMissing({ id })` |
| A driver error inside a service method | `Effect.mapError` into the service error, once                        |
| A real answer for one failure          | `Effect.catchTag`, `Effect.catchTags`                                 |
| Several kinds behind one service error | A `reason` field. `Effect.catchReason`                                |
| A Promise or SDK call                  | `Effect.tryPromise({ try: (signal) => ..., catch })`                  |
| Work that must not stop the caller     | A `Data.taggedEnum` outcome plus `Effect.logWarning`                  |
| Failures as data in a batch            | `Effect.result`                                                       |
| A bug or impossible state              | `Effect.die(defect)`                                                  |
| Inspect a failure at the entry         | `Exit.match`, `Effect.logError("failed", cause)`                      |

## Define

**Use** `Schema.TaggedError` for every expected failure. **Not** `Data.TaggedError`, `class X extends Error`, or a string.
**Why:** fields are validated on construction and encode through the schema. `_tag` is what `catchTag` matches.

- **Fields** carry what a handler reads: ids, `operation`, `status`, `retryable`. `cause: Schema.Defect()` holds an unknown failure.
- **`retryable`** is set where 429, 5xx, and transport failures are classified. `Effect.retry({ while: (error) => error.retryable, times, schedule })` reads it. Read [time](time.md).
- **`message`** is a field, or a getter built from fields. Never build it from `cause`.
- **Fail** with `return yield* new ItemMissing({ id })` in a generator. In a pipeline, `Effect.fail(error)`.
- **Returning** `{ _tag: "ItemMissing" }` is a success. Callers act on it as one.
- **Translate** driver errors once per service method: `Effect.mapError` into the service error.
- **Library errors** like `HttpClientError` are `Data.TaggedError`. Catch them. Do not copy the shape.

## Recover

**Use** `catchTag` or `catchTags` where a real answer exists: a fallback, a retry, a response. **Not** to shorten a type — leave the error in `E`.
**Why:** unhandled failures stay visible in `E`. A new error class shows up at every edge.

- `Effect.catchTag("ItemMissing", f)` handles one tag. `catchTag(["A", "B"], f)` shares a handler. `catchTags({ A: f, B: g })` handles several.
- `Effect.catch(f)` and `Effect.matchEffect({ onFailure, onSuccess })` see every `E`. Use them at the edge only.

```ts
import { Effect, Schema } from "effect";

export class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", {
  id: Schema.String,
}) {
  override get message(): string {
    return `item ${this.id} is missing`;
  }
}
export class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}
class DriverError extends Schema.TaggedError<DriverError>()("DriverError", {
  code: Schema.String,
}) {}
declare const queryRow: (id: string) => Effect.Effect<string | undefined, DriverError>;
export const findItem = Effect.fn("ItemStore.findItem")(function* (id: string) {
  const row = yield* queryRow(id).pipe(
    Effect.mapError((cause) => new StoreError({ operation: "findItem", cause })),
  );
  if (row === undefined) return yield* new ItemMissing({ id });
  return row;
});
export const handleRead = Effect.fn("Http.handleRead")((id: string) =>
  findItem(id).pipe(
    Effect.map((body) => ({ status: 200, body })),
    Effect.catchTags({
      ItemMissing: (error) => Effect.succeed({ status: 404, body: error.message }),
      StoreError: (error) => Effect.succeed({ status: 503, body: `retry ${error.operation}` }),
    }),
  ),
);
```

## Reasons

**Use** a tagged `reason` field when callers branch on the failure kind. **Not** for a single kind — use plain fields.
**Why:** `E` stays one tag per service. Handlers narrow by reason. `HttpClientError`, `SqlError`, and `AiError` use this shape.

- `Effect.catchReason("ProviderError", "RateLimited", (reason, error) => ..., orElse?)` handles one reason. Without `orElse`, `ProviderError` stays in `E`.
- `Effect.catchReasons("ProviderError", { RateLimited: f, Rejected: g }, orElse?)` handles several.
- `Effect.unwrapReason("ProviderError")` moves the reasons into `E` for `catchTags`.

```ts
import { Effect, Schema } from "effect";

class RateLimited extends Schema.TaggedError<RateLimited>()("RateLimited", {
  retryAfterMillis: Schema.Finite,
}) {}
class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { status: Schema.Int }) {}
class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  reason: Schema.Union([RateLimited, Rejected]),
}) {}
declare const summarize: (text: string) => Effect.Effect<string, ProviderError>;
declare const queueForLater: (text: string, delayMillis: number) => Effect.Effect<string>;
export const summarizeOrQueue = Effect.fn("Summarizer.summarizeOrQueue")((text: string) =>
  summarize(text).pipe(
    Effect.catchReason("ProviderError", "RateLimited", (reason) =>
      queueForLater(text, reason.retryAfterMillis),
    ),
  ),
);
```

## Inspect

| Call                    | Gives                              | Use in                                                    |
| ----------------------- | ---------------------------------- | --------------------------------------------------------- |
| `Effect.result(effect)` | `Result<A, E>`. Defects still fail | App code that returns failures as data, like a batch      |
| `Effect.exit(effect)`   | `Exit<A, E>` with the full `Cause` | The entry, or a test that checks defects                  |
| `Effect.flip(effect)`   | The error as the success           | A test that asserts the error. Read [testing](testing.md) |

**Not** `Effect.option` to inspect a failure. It turns every error into `None`.
**Why:** `result` and `flip` keep the tag and fields a caller reads.

## Defects and Cause

**Use** `Effect.die(defect)` for bugs and impossible states. **Not** for I/O that can fail — that is an expected error in `E`.
**Why:** a defect skips every `catchTag`. A dead query becomes a 500 with no retry and no answer.
`Effect.orDie` turns `E` into a defect. Never `orDie` a DB, HTTP, or SDK call. Use it only when the error proves a bug: decoding a constant you wrote.
Only the entry point inspects `Cause`. Everywhere else uses `catchTag`.
`Effect.logError("read failed", cause)` logs the whole `Cause`. `Cause.pretty(cause)` renders it as text.
`Cause.hasInterruptsOnly(cause)` detects a cancel. `Cause.findErrorOption(cause)` returns the first typed error.
`NodeRuntime.runMain` logs unhandled failures and sets the exit code. Read [services](services.md).

```ts
import { Cause, Effect, Exit, Schema } from "effect";

class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  operation: Schema.String,
}) {}
declare const readItem: (id: string) => Effect.Effect<string, StoreError>;
export const handle = async (
  id: string,
): Promise<{ readonly status: number; readonly body: string }> => {
  const exit = await Effect.runPromiseExit(
    readItem(id).pipe(Effect.tapCause((cause) => Effect.logError("read failed", cause))),
  );
  return Exit.match(exit, {
    onSuccess: (body) => ({ status: 200, body }),
    onFailure: (cause) => ({
      status: Cause.hasInterruptsOnly(cause) ? 503 : 500,
      body: "read failed",
    }),
  });
};
```

## Interruption

**Use** `Effect.onInterrupt`, `Effect.ensuring`, or `Effect.acquireRelease` for cleanup on cancel. **Not** a catch.
**Why:** interruption is not an error and never appears in `E`. `Effect.catch` and `catchTag` never see it.
`Effect.catchCause` sees a self-interrupt (`Effect.interrupt`) and can turn it into a success. An outside `Fiber.interrupt` skips every handler. Read [concurrency](concurrency.md).

## Promises

**Use** `Effect.tryPromise({ try: (signal) => ..., catch })` for any Promise that can reject. **Not** `Effect.promise` — a rejection becomes a defect.
**Why:** `catch` puts a typed error in `E`. Interruption aborts `signal`. Pass it to the SDK, or the call keeps running.

- The one-argument form `Effect.tryPromise((signal) => ...)` fails with `Cause.UnknownError`. Use the object form.
- A `catch` that throws becomes a defect. Return the error instead. `Effect.promise` fits only a Promise that cannot reject.
- An HTTP API goes through `HttpClient`, not `fetch`. Read [http](http.md).

```ts
import { Effect, Schema } from "effect";

class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}
interface SummaryClient {
  readonly summarize: (text: string, options: { readonly signal: AbortSignal }) => Promise<string>;
}
export const summarize = Effect.fn("Summarizer.summarize")((client: SummaryClient, text: string) =>
  Effect.tryPromise({
    try: (signal) => client.summarize(text, { signal }),
    catch: (cause) => new ProviderError({ operation: "summarize", cause }),
  }),
);
```

## Best effort

**Use** a `Data.taggedEnum` outcome plus `Effect.logWarning` when a failure must not stop the caller. **Not** `Effect.ignore` or a catch returning `Effect.void`.
**Why:** callers and tests see the outcome. Operators see the log.

```ts
import { Data, Effect, Schema } from "effect";

class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  operation: Schema.String,
}) {}
export type Warmup = Data.TaggedEnum<{
  Warmed: { readonly count: number };
  Skipped: { readonly operation: string };
}>;
export const Warmup = Data.taggedEnum<Warmup>();
declare const warmCache: Effect.Effect<number, StoreError>;
export const warmBestEffort = warmCache.pipe(
  Effect.map((count) => Warmup.Warmed({ count })),
  Effect.catchTag("StoreError", (error) =>
    Effect.as(
      Effect.logWarning("cache warmup skipped", { operation: error.operation }),
      Warmup.Skipped({ operation: error.operation }),
    ),
  ),
);
```

## Fail review on

```ts
saveItem(item).pipe(Effect.ignore);
saveItem(item).pipe(Effect.catch(() => Effect.void));
saveItem(item).pipe(Effect.orElseSucceed(() => null));
runJob.pipe(Effect.catchCause(() => Effect.succeed("done")));
```

Each hides the failure. `catchCause` also eats defects and interrupts. Catch a tag with a real answer, or return an outcome and log it.

```ts
class ItemMissing extends Error {}
Effect.fail("item missing");
```

Write `class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", { id: Schema.String }) {}`.

```ts
sql`SELECT * FROM items WHERE id = ${id}`.pipe(Effect.orDie);
Effect.promise(() => sdk.summarize(text));
```

Both turn an expected failure into a defect. `mapError` the query to the service error. Wrap the SDK in `Effect.tryPromise`.

## Upstream

`node_modules/effect/ai-docs/src/01_effect/04_errors/01_error-handling.ts`, `.../04_errors/20_reason-errors.ts`
