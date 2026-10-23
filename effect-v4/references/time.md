# Time

Retry, repeat, schedules, timeouts, deadlines, polling, and the clock.

## Which one

| Need                            | Use                                                         |
| ------------------------------- | ----------------------------------------------------------- |
| Retry a transient typed failure | `Effect.retry({ while, times, schedule })`                  |
| A schedule that reads the error | `Effect.retry(($) => $(schedule).pipe(...))`                |
| Poll until a check reports done | `Effect.repeat({ schedule, until, times })`                 |
| Cap one attempt                 | `Effect.timeoutOrElse({ duration, orElse })` before `retry` |
| Cap all attempts together       | `Effect.timeoutOrElse` after `retry`                        |
| Wait, read the time, measure    | `Effect.sleep`, `Clock.currentTimeMillis`, `Effect.timed`   |

## Retry

**Use** `Effect.retry({ while, times, schedule })` when a typed failure is transient. **Not** for defects or a non-idempotent write — fix the bug, or make the write idempotent first.
**Why:** a bounded policy at the failing call turns a blip into success.
Shape: `call.pipe(Effect.retry({ while: (e) => e.retryable, times: 3, schedule: Schedule.exponential("200 millis").pipe(Schedule.jittered) }))`.
**Gotchas**

- No `schedule` retries with no delay. No `times` and no bounded schedule retries forever.
- `times: 3` is three retries after the first attempt. That is four calls.
- Defects and interrupts are never retried.
- `while` continues on `true`. `until` stops on `true`. Both see the typed error.
- When the policy stops, the last failure propagates.

## Schedules

**Use** a `Schedule` for the delay and the stop rule between runs. **Not** for one pause — use `Effect.sleep`.
**Why:** one value holds backoff, cap, jitter, and bound.

| Need                   | Write                                                                              | Note                                                     |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Backoff                | `Schedule.exponential("200 millis")`                                               | Doubles forever. Uncapped.                               |
| Cap the delay          | `Schedule.min([Schedule.exponential("200 millis"), Schedule.spaced("5 seconds")])` | `min`: continues while either does, shorter delay.       |
| Stop when either stops | `Schedule.max([a, b])`                                                             | Longer delay.                                            |
| Gap after each run     | `Schedule.spaced("30 seconds")`                                                    | Polling, retry.                                          |
| Fixed cadence          | `Schedule.fixed("1 minute")`                                                       | A late run fires at once. Missed ticks are not replayed. |
| Count                  | `Schedule.recurs(5)`                                                               | Five more runs after the first.                          |
| Spread a herd          | `Schedule.jittered`                                                                | Delay × 0.8–1.2.                                         |
| Bound a schedule       | `Schedule.upTo({ times: 5, duration: "1 minute" })`                                | Stops the schedule. Never interrupts a running attempt.  |
| Decide per step        | `Schedule.while(({ input, attempt, elapsed }) => ...)`                             | `input` is the error or value.                           |
| Override one delay     | `Schedule.modifyDelay(({ input, duration }) => Effect.succeed(...))`               | Retry-After.                                             |
| Calendar               | `Schedule.cron("0 3 * * *", "UTC")`                                                | `E` gains `Cron.CronParseError`.                         |

v3 `union`/`either` is `min`. `intersect`/`both` is `max`. `andThen` is `concat`. See [v3 traps](v3-traps.md).

## Read the error

**Use** the builder `Effect.retry(($) => $(schedule).pipe(...))` when the schedule reads the error. **Not** when `{ while, times, schedule }` is enough.
**Why:** `$` fixes the schedule input to `E`, so `input.retryAfterMillis` type-checks.

```ts
import { Duration, Effect, Schedule, Schema } from "effect";

class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  retryable: Schema.Boolean,
  retryAfterMillis: Schema.NullOr(Schema.Finite),
}) {}

export const retryHonoringRetryAfter = <A, R>(call: Effect.Effect<A, ProviderError, R>) =>
  call.pipe(
    Effect.retry(($) =>
      $(Schedule.exponential("200 millis")).pipe(
        Schedule.modifyDelay(({ input, duration }) =>
          Effect.succeed(
            input.retryAfterMillis === null ? duration : Duration.millis(input.retryAfterMillis),
          ),
        ),
        Schedule.while(({ input }) => input.retryable),
        Schedule.upTo({ times: 3 }),
      ),
    ),
  );
```

**Gotchas**

- Decode `Retry-After` into the error at the boundary. The schedule reads a number, not a header.
- A long `Retry-After` still counts against the overall deadline.
- A shared schedule value types its input with `Schedule.setInputType<ProviderError>()`, first in its pipe.

## Polling

**Use** `Effect.repeat({ schedule, until, times })` to re-run a successful check until it reports done. **Not** for failures — that is `retry`.
**Why:** the bound ends the loop. The last value says whether it finished.

```ts
import { Context, Data, Effect, Schedule, Schema } from "effect";

type ExportStatus = Data.TaggedEnum<{ Running: {}; Ready: { readonly url: string } }>;
class ExportPending extends Schema.TaggedError<ExportPending>()("ExportPending", {
  exportId: Schema.String,
}) {}
class ExportApi extends Context.Service<
  ExportApi,
  {
    readonly status: (exportId: string) => Effect.Effect<ExportStatus>;
  }
>()("@app/provider/ExportApi") {}

export const awaitExport = Effect.fn("Exports.awaitExport")(function* (exportId: string) {
  const api = yield* ExportApi;
  const status = yield* api.status(exportId).pipe(
    Effect.repeat({
      schedule: Schedule.spaced("2 seconds"),
      until: (s) => s._tag === "Ready",
      times: 30,
    }),
  );
  if (status._tag === "Running") return yield* new ExportPending({ exportId });
  return status.url;
});
```

**Gotchas**

- The first run happens before the schedule. `times: 30` is 31 checks.
- `repeat` stops at the first failure.
- The options form returns the last value. `Effect.repeat(schedule)` returns the schedule's output.

## Timeouts

**Use** a timeout on every call that can hang. **Not** `Effect.race` with `Effect.sleep`.
**Why:** a hung socket holds the fiber forever. A timeout turns it into a value or an error.

| Call                                         | On timeout                 | Use when                                       |
| -------------------------------------------- | -------------------------- | ---------------------------------------------- |
| `Effect.timeoutOrElse({ duration, orElse })` | Runs `orElse`              | Default. Map the timeout to the service error. |
| `Effect.timeout(duration)`                   | Fails `Cause.TimeoutError` | A caller handles `"TimeoutError"` itself.      |
| `Effect.timeoutOption(duration)`             | Succeeds `Option.none()`   | No result is a normal outcome.                 |

All three interrupt the source when time runs out. Interruption runs finalizers and aborts a `tryPromise` signal.

## Compose

**Use** a per-attempt timeout before `retry` and an overall deadline after it. **Not** a retry around a whole workflow — it repeats work that already succeeded.
**Why:** the attempt timeout turns a hang into a retryable error. The deadline caps the total.
Pass all three as extra `Effect.fn` arguments of the provider method, in this order, after the error mapping.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Ref, Schedule, Schema } from "effect";
import { TestClock } from "effect/testing";

class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  retryable: Schema.Boolean,
  message: Schema.String,
}) {}

it.effect("hung attempts retry three times, then the deadline wins", () =>
  Effect.gen(function* () {
    const attempts = yield* Ref.make(0);
    const fetchItem = Effect.fn("Catalog.fetchItem")(
      function* () {
        yield* Ref.update(attempts, (n) => n + 1);
        return yield* Effect.never;
      },
      Effect.timeoutOrElse({
        duration: "2 seconds",
        orElse: () =>
          Effect.fail(new ProviderError({ retryable: true, message: "attempt timed out" })),
      }),
      Effect.retry({
        while: (error) => error.retryable,
        times: 3,
        schedule: Schedule.exponential("500 millis"),
      }),
      Effect.timeoutOrElse({
        duration: "10 seconds",
        orElse: () =>
          Effect.fail(new ProviderError({ retryable: false, message: "deadline exceeded" })),
      }),
    );
    const fiber = yield* Effect.forkChild(Effect.flip(fetchItem()));
    yield* TestClock.adjust("9999 millis");
    assert.strictEqual(yield* Ref.get(attempts), 4);
    yield* TestClock.adjust("1 millis");
    assert.strictEqual((yield* Fiber.join(fiber)).message, "deadline exceeded");
  }),
);
```

**Gotchas**

- One retry owner per failure. A `retryable` field on the error decides.
- Set SDK retries to zero (`maxRetries: 0`) when Effect retries. Stacked owners multiply attempts.
- `HttpClient.retryTransient({ schedule, times })` is a retry owner too. Pick it or `Effect.retry`. See [http](http.md).
- Queue redelivery and not-ready-yet are not provider retries. Poll, or wait for the next run.
- `Schedule.jittered` randomizes delays. Assert exact timings only without it.

## Clock

**Use** `Effect.sleep("1 second")`, `Clock.currentTimeMillis`, and `Effect.timed(effect)`. **Not** `setTimeout`, `Date.now()`, or end-minus-start math.
**Why:** `TestClock` controls all three. `Effect.timed` returns `[Duration, A]` from a monotonic clock.
A `Duration` input is a number of milliseconds or a string like `"500 millis"`. For `DateTime` and `Duration`, read [core](core.md). For `TestClock`, read [testing](testing.md).

## Fail review on

```ts
call.pipe(Effect.retry({ while: (error) => error.retryable }));
```

Add `times` and a `schedule`. This retries at full speed forever.

```ts
call.pipe(
  Effect.timeout("2 seconds"),
  Effect.catchTag("TimeoutError", () => Effect.fail(timedOut)),
);
```

Write `Effect.timeoutOrElse({ duration, orElse })`.

## Upstream

`node_modules/effect/ai-docs/src/06_schedule/10_schedules.ts`, `node_modules/effect/src/Schedule.ts`
