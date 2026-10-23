# Core

The `Effect` value, the daily combinators, and the data types beside them.

## Pick

| I have                        | Write                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| A value                       | `Effect.succeed(value)`                                                      |
| Sync code that cannot throw   | `Effect.sync(() => read())`. A throw becomes a defect                        |
| Sync code that throws         | `Effect.try({ try, catch })`. `catch` returns a tagged error                 |
| An expected failure           | `return yield* new ItemMissing({ id })`. In a pipeline, `Effect.fail(error)` |
| An effect to build per run    | `Effect.suspend(() => effect)`: recursion, fresh state                       |
| Nothing to return             | `Effect.void`                                                                |
| A Promise                     | `Effect.tryPromise({ try, catch })`. Read [errors](errors.md)                |
| A reusable effectful function | `Effect.fn("Owner.method")`                                                  |
| One-off sequencing            | `Effect.gen` + `yield*`                                                      |
| A pure step on a success      | `Effect.map(f)`                                                              |
| Pure work over a list         | `xs.map(f)`                                                                  |

## Gen and fn

**Use** `Effect.fn("Owner.method")` for every reusable effectful function. **Not** for one-off sequencing — inline `Effect.gen`.
**Why:** the name is the span and the stack frame. A function returning `Effect.gen` has neither.

- **Generator form** is the default. `yield*` waits. `return yield* new E(...)` fails.
- **Arrow form** fits a one-pipeline body: `Effect.fn("X.y")((input: T) => effect.pipe(...))`. A ternary that returns two different Effect types does not infer there. Use the generator.
- **Extra arguments** carry the policy: timeout, retry, catch, log annotations. Each receives `(effect, ...args)` and runs inside the span. Never `.pipe` the `Effect.fn` result. It is a function, not an Effect.
- **`Effect.fn.Return<A, E, R>`** annotates the generator when the type must be spelled out.
- **`Effect.fnUntraced(function* () {})`** is the same shape with no span. It takes a generator only. Use it for hot paths and library internals.

```ts
import { Effect, Schema } from "effect";

class EmptyText extends Schema.TaggedError<EmptyText>()("EmptyText", {}) {}
class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  retryable: Schema.Boolean,
}) {}
declare const callProvider: (text: string) => Effect.Effect<string, ProviderError>;

export const summarize = Effect.fn("Summarizer.summarize")(
  function* (text: string): Effect.fn.Return<string, EmptyText | ProviderError> {
    if (text.trim() === "") return yield* new EmptyText();
    const summary = yield* callProvider(text);
    return summary.trim();
  },
  Effect.timeoutOrElse({
    duration: "10 seconds",
    orElse: () => Effect.fail(new ProviderError({ retryable: true })),
  }),
  (effect, text) => Effect.annotateLogs(effect, { chars: text.length }),
);
export const program = Effect.gen(function* () {
  const first = yield* summarize("first text");
  return [first, yield* summarize("second text")];
});
```

## Channels

| Combinator                               | Runs on      | Does                         |
| ---------------------------------------- | ------------ | ---------------------------- |
| `Effect.map(f)`                          | success      | `A → B` with a pure `f`      |
| `Effect.flatMap(f)`, `Effect.andThen(f)` | success      | `A → Effect<B>`              |
| `Effect.tap(f)`                          | success      | Runs `A → Effect`, keeps `A` |
| `Effect.as(value)`                       | success      | Replaces `A`                 |
| `Effect.zip(that, { concurrent })`       | both succeed | `[A, B]`                     |
| `Effect.mapError(f)`                     | failure      | `E → E2`                     |

`map` runs on success only. A failure skips every success combinator.
**Use** `Effect.map` for a pure step. **Not** `andThen` or `tap` — they reject a function returning a plain value.
**Collections.** `xs.map(f)` when `f` is pure. `Effect.forEach(xs, f, { concurrency })` only when `f` returns a real Effect.
**Why:** wrapping pure work in `succeed` or `sync` hides that nothing can fail.
`forEach` is sequential by default and keeps input order. `{ discard: true }` returns `void`.
**Void.** Annotate the result as `Effect.Effect<void, E>`. Any `Effect<A, E>` is assignable.
Do not write `Effect.asVoid` or `Effect.map(() => undefined)`. The language service suggests `asVoid` for the second. Annotate instead.

```ts
import { Effect, Schema } from "effect";

class DriverError extends Schema.TaggedError<DriverError>()("DriverError", {
  code: Schema.String,
}) {}
class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}
declare const loadItem: (
  id: string,
) => Effect.Effect<{ readonly name: string; readonly quantity: number }, DriverError>;

export const itemLabel = Effect.fn("ItemStore.itemLabel")((id: string) =>
  loadItem(id).pipe(
    Effect.tap((item) => Effect.logDebug("item loaded", { id, name: item.name })),
    Effect.map((item) => `${item.name} (${item.quantity})`),
    Effect.mapError((cause) => new StoreError({ operation: "itemLabel", cause })),
  ),
);
export const labelAll = Effect.fn("ItemStore.labelAll")((ids: ReadonlyArray<string>) =>
  Effect.forEach(
    ids.map((id) => id.trim()),
    (id) => itemLabel(id),
    { concurrency: 4 },
  ),
);
export const warmLabels: (ids: ReadonlyArray<string>) => Effect.Effect<void, StoreError> = labelAll;
```

**pipe and flow.** `x.pipe(f, g)` when `x` has `.pipe`. `pipe(x, f, g)` for a value without `.pipe`.
`flow(f, g)` returns a function. Use it only when a combinator wants a function and no value exists yet: `ids.map(flow(Str.trim, Str.toLowerCase))`.
Do not wrap combinators in object-argument helpers like `withRetry({ effect, times })`. Keep `pipe` positional.

## Ambient globals

| Global                     | Effect                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `Date.now()`, `new Date()` | `Clock.currentTimeMillis`, `DateTime.now`                                               |
| `Math.random()`            | `Random.next`, `Random.nextIntBetween(min, max)` (inclusive)                            |
| `console.log`              | `Effect.logInfo("message")`, `logWarning`, `logError`; fields via `Effect.annotateLogs` |
| `setTimeout`               | `Effect.sleep("1 second")`                                                              |

**Use** the Effect version inside Effect code. **Not** the global — tests cannot control it.
**Why:** `TestClock` moves time. `Random.withSeed` fixes randomness. Log levels and spans apply.
**Duration.** Every time API takes `Duration.Input`: `"5 seconds"`, `"500 millis"`, millis as a number, `Duration.seconds(5)`.
**DateTime.** `DateTime.now` is an Effect on `Clock`. `make`, `add`, `formatIso`, `format`, `setZoneNamed` are pure.
`DateTime.make(input)` and `setZoneNamed` return `Option`. Do not call `DateTime.nowUnsafe`. It reads the wall clock.

```ts
import { Clock, DateTime, Effect, Option, Random } from "effect";

export const scheduleCheck = Effect.fn("Audit.scheduleCheck")(function* (
  itemId: string,
  zone: string,
) {
  const startedAt = yield* Clock.currentTimeMillis;
  yield* Effect.sleep(yield* Random.nextIntBetween(0, 250));
  const due = DateTime.add(yield* DateTime.now, { days: 3 });
  yield* Effect.logInfo("check scheduled", {
    itemId,
    waitedMillis: (yield* Clock.currentTimeMillis) - startedAt,
  });
  return Option.match(DateTime.setZoneNamed(due, zone), {
    onNone: () => DateTime.formatIso(due),
    onSome: (zoned) => DateTime.format(zoned, { dateStyle: "medium", locale: "en-US" }),
  });
});
```

## Option and Result

**Use** `Option` when a caller must branch on absence. **Not** in wire or storage shapes — keep `null` there.
**Why:** `Option` forces the branch. JSON and SQL carry `null`.
Convert at the edge: `Option.fromNullOr(row.note)`, `Option.fromUndefinedOr(map.get(id))`, `Option.fromNullishOr(x)`. Back with `Option.getOrNull`.
**Use** `Result` for a pure check that returns success or failure as data. **Not** for I/O — return an Effect.
`Effect.fromResult(result)` lifts it. `Effect.result(effect)` turns typed failures into a `Result`.

```ts
import { Effect, Option, Result, Schema } from "effect";

class OutOfStock extends Schema.TaggedError<OutOfStock>()("OutOfStock", {
  requested: Schema.Int,
  available: Schema.Int,
}) {}

export const noteLabel = (note: string | null) =>
  Option.match(Option.fromNullOr(note), {
    onNone: () => "no note",
    onSome: (text) => `note: ${text}`,
  });
export const checkStock = (
  available: number,
  requested: number,
): Result.Result<number, OutOfStock> =>
  requested <= available
    ? Result.succeed(requested)
    : Result.fail(new OutOfStock({ requested, available }));
export const reserve = Effect.fn("ItemStore.reserve")((available: number, requested: number) =>
  Effect.fromResult(checkStock(available, requested)),
);
```

## Data and Match

**Use** `Data.taggedEnum` for a success union a caller switches on. **Not** `{ _tag: "X" as const }` — that skips the constructor.
**Why:** constructors type each case. `$match` breaks the build when a case is added.
`Stock.$is("InStock")` is a guard. `Equal.equals(a, b)` compares structurally, plain objects included.
**Use** `Match.type<T>()` for a non-tagged union, `Match.value(x)` for one value. **Not** for a `taggedEnum` — use `$match`. `Match.exhaustive` fails compilation on a missed case.

```ts
import { Data, Match } from "effect";

export type Stock = Data.TaggedEnum<{
  InStock: { readonly quantity: number };
  Backordered: { readonly days: number };
}>;
export const Stock = Data.taggedEnum<Stock>();
export const stockLabel = Stock.$match({
  InStock: ({ quantity }) => `${quantity} left`,
  Backordered: ({ days }) => `ships in ${days} days`,
});
export const priceLabel = Match.type<string | number>().pipe(
  Match.when(Match.number, (cents) => `${cents / 100} USD`),
  Match.when(Match.string, (text) => text),
  Match.exhaustive,
);
```

## Helpers

| Module                        | Earns its place                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Array`                       | `Array.groupBy(xs, f)`, `Array.dedupe(xs)`, `Array.head(xs)` returns `Option`                                                                                   |
| `Record`, `Struct`            | `Record.map(r, f)`, `Struct.pick(item, ["id"])`, `Struct.omit`, `Struct.evolve`                                                                                 |
| `String`, `Predicate`         | `String.trim` and `String.toLowerCase` compose in `flow`. `xs.filter(Predicate.isNotNullish)`. Untrusted input goes through Schema                              |
| `Order`, `Equivalence`        | `Array.sort(xs, Order.mapInput(Order.Number, (item: Item) => item.price))`. `Array.dedupeWith(xs, Equivalence.mapInput(Equivalence.String, (item) => item.id))` |
| `Chunk`, `HashMap`, `HashSet` | Only when an API hands you one. `Chunk.toReadonlyArray` converts                                                                                                |

**Use** a module when it is shorter than native. **Not** by default — native `.map`, `.filter`, `Map`, and `Set` are fine.
**Why:** helpers return `Option` instead of `undefined`, and work inside `pipe`.
`Array`, `String`, and `Record` shadow built-in names. Import `{ String as Str }` when the file uses the built-in.
**Brand.** Use `Schema.brand("ItemId")`, checked at decode. Read [schema](schema.md).
**Running.** Run an Effect once, at the edge. Read [services](services.md).

## Fail review on

```ts
Effect.forEach(items, (item) => Effect.succeed(item.price * 2));
```

That is `items.map((item) => item.price * 2)`.

```ts
function loadItem(id: string) {
  return Effect.gen(function* () {
    return yield* store.get(id);
  });
}
const load = Effect.fn("ItemStore.load")(function* (id: string) {
  return yield* store.get(id);
}).pipe(Effect.timeout("1 second"));
```

Write `Effect.fn("ItemStore.load")(body, Effect.timeoutOrElse({ duration, orElse }))`.

```ts
const startedAt = Date.now();
console.log("done", Math.random());
```

Use `Clock.currentTimeMillis`, `Effect.logInfo`, and `Random.next`.

## Upstream

`node_modules/effect/ai-docs/src/01_effect/01_basics/02_effect-fn.ts`, `.../01_basics/10_creating-effects.ts`, `node_modules/effect/ai-docs/src/07_datetime/10_creating-and-formatting.ts`
