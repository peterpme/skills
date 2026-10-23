# Streams

`Stream<A, E, R>` is a lazy description of values over time: pages, subscriptions, callbacks, response bodies.

| You have                                               | Use                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| One value or one failure                               | `Effect`                                                          |
| An in-memory list                                      | An array: `xs.map(f)`, `xs.filter(p)`. Never `Stream` or `Chunk`. |
| Repeated work that emits nothing                       | `Effect.repeat` with a `Schedule` ([time](time.md))               |
| Many values over time, unknown length, or backpressure | `Stream`                                                          |

## Sources

| Source                                             | Constructor                                                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pages behind a cursor                              | `Stream.paginate(start, (cursor) => Effect<[items, Option<next>]>)`                                                                 |
| A stream that needs an effect first                | `Stream.unwrap(effectOfStream)`                                                                                                     |
| One effect                                         | `Stream.fromEffect(effect)`                                                                                                         |
| An iterable, only when the consumer takes a stream | `Stream.fromIterable(xs)`                                                                                                           |
| Integers, both ends inclusive                      | `Stream.range(1, 5)`                                                                                                                |
| A listener that emits many values                  | `Stream.callback((queue) => register)`                                                                                              |
| A `Queue`, `PubSub`, or `SubscriptionRef`          | `Stream.fromQueue(queue)`, `Stream.fromPubSub(pubsub)`, `SubscriptionRef.changes(ref)`                                              |
| An SDK `AsyncIterable` or web `ReadableStream`     | `Stream.fromAsyncIterable(iterable, onError)`, `Stream.fromReadableStream({ evaluate, onError })`; `onError` returns a tagged error |
| Polling                                            | `Stream.fromEffectSchedule(effect, schedule)`                                                                                       |
| NDJSON or SSE text                                 | `Stream.pipeThroughChannel(Ndjson.decodeSchemaString(Product)())`; `Ndjson` and `Sse` are in `effect/encoding`                      |

**Use** `Stream.paginate` for cursor APIs. **Not** a manual loop that concatenates arrays — it holds every page in memory.
**Why:** each page is fetched only when the consumer pulls. `Stream.take(n)` stops fetching.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Option, Schema, Stream } from "effect";

class Product extends Schema.Class<Product>("Product")({ id: Schema.String }) {}
class CatalogPage extends Schema.Class<CatalogPage>("CatalogPage")({
  products: Schema.Array(Product),
  next: Schema.NullOr(Schema.String),
}) {}

const catalogProducts = <E, R>(fetchPage: (cursor: string) => Effect.Effect<CatalogPage, E, R>) =>
  Stream.paginate("start", (cursor: string) =>
    fetchPage(cursor).pipe(
      Effect.map((page) => [page.products, Option.fromNullishOr(page.next)] as const),
    ),
  );

const recordedPages = new Map<string, unknown>([
  ["start", { products: [{ id: "a" }, { id: "b" }], next: "p2" }],
  ["p2", { products: [{ id: "c" }], next: null }],
]);

it.effect("reads pages until next is null", () =>
  Effect.gen(function* () {
    const fetchRecorded = (cursor: string) =>
      Schema.decodeUnknownEffect(CatalogPage)(recordedPages.get(cursor));
    const products = yield* Stream.runCollect(catalogProducts(fetchRecorded));
    assert.deepStrictEqual(
      products.map((product) => product.id),
      ["a", "b", "c"],
    );
  }),
);
```

## Transform

**Use** `Stream.mapEffect(f, { concurrency: n })` for I/O per item. **Not** `Stream.map` with an Effect inside — that emits Effects.
**Why:** `concurrency` bounds active calls. Output order is kept unless `unordered: true`.

```ts
import { Duration, Effect, Schema, Stream } from "effect";

class Product extends Schema.Class<Product>("Product")({ id: Schema.String }) {}
class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  cause: Schema.Defect(),
}) {}
declare const products: Stream.Stream<Product, StoreError>;
declare const saveBatch: (batch: ReadonlyArray<Product>) => Effect.Effect<void, StoreError>;

export const copyProducts = Effect.fn("ProductCopy.run")(
  (input: {
    readonly batchSize: number;
    readonly flushAfter: Duration.Input;
    readonly concurrency: number;
  }) =>
    products.pipe(
      Stream.groupedWithin(input.batchSize, input.flushAfter),
      Stream.mapEffect(saveBatch, { concurrency: input.concurrency }),
      Stream.runDrain,
    ),
);
```

- `Stream.grouped(n)` and `Stream.groupedWithin(n, duration)` emit non-empty arrays. Use them to batch writes.
- `Stream.map`, `Stream.filter`, and `Stream.take(n)` are lazy. `Stream.buffer({ capacity, strategy })` lets a fast producer run ahead; it destroys chunking.

## Consume

| Run                               | Returns             | When                                                                                                                                              |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Stream.runForEach(stream, f)`    | `Effect<void>`      | an effect per item                                                                                                                                |
| `Stream.runDrain(stream)`         | `Effect<void>`      | the work already happens inside the stream                                                                                                        |
| `Stream.runCollect(stream)`       | `Effect<Array<A>>`  | bounded streams only                                                                                                                              |
| `Stream.run(stream, sink)`        | the sink's result   | a reusable reduction; `Sink` and `Channel` are rare                                                                                               |
| `Stream.toReadableStream(stream)` | `ReadableStream<A>` | a fetch `Response` body; requires `R = never`, else `Stream.toReadableStreamEffect`. `effect/http` servers use `HttpServerResponse.stream(bytes)` |

## Callback streams

**Use** `Stream.callback((queue) => effect, { bufferSize, strategy })` for listeners. **Not** for one value — use `Effect.callback` ([concurrency](concurrency.md)).
**Why:** the register effect runs in the stream's scope. Its finalizer removes the listener when the stream ends.

```ts
import { Cause, Effect, Queue, Schema, Stream } from "effect";
import type { EventEmitter } from "node:events";

class FeedError extends Schema.TaggedError<FeedError>()("FeedError", { cause: Schema.Defect() }) {}
export const itemIds = (feed: EventEmitter, bufferSize: number) =>
  Stream.callback<string, FeedError>(
    (queue) => {
      const onItem = (id: string) => Queue.offerUnsafe(queue, id);
      const onEnd = () => Queue.endUnsafe(queue);
      const onError = (cause: unknown) =>
        Queue.failCauseUnsafe(queue, Cause.fail(new FeedError({ cause })));
      return Effect.acquireRelease(
        Effect.sync(() => feed.on("item", onItem).on("end", onEnd).on("error", onError)),
        () => Effect.sync(() => feed.off("item", onItem).off("end", onEnd).off("error", onError)),
      );
    },
    { bufferSize, strategy: "sliding" },
  );
```

**Gotchas**

- The default buffer is unbounded. Pass `bufferSize` and `strategy`.
- `Queue.offerUnsafe` never waits. On a full `"suspend"` buffer it drops the item and returns `false`.
- A failure returned by the register effect is lost, and the stream hangs. Fail through the queue.

## Errors and deadlines

A failure ends the stream. Recover with `Stream.catchTag`, or map with `Stream.mapError`.
**Use** `Stream.interruptWhen(deadline)` with a failing effect for a total deadline. **Not** `Stream.timeout` — it ends the stream successfully when one pull idles past the duration.
**Why:** a caller of `Stream.timeout` cannot tell a stall from the end.

```ts
import { Duration, Effect, Schema, Stream } from "effect";

class StreamDeadline extends Schema.TaggedError<StreamDeadline>()("StreamDeadline", {}) {}
export const withDeadline =
  (deadline: Duration.Input) =>
  <A, E, R>(stream: Stream.Stream<A, E, R>) =>
    stream.pipe(
      Stream.interruptWhen(
        Effect.sleep(deadline).pipe(Effect.andThen(Effect.fail(new StreamDeadline()))),
      ),
    );
```

- An idle limit per pull that fails is `Stream.timeoutOrElse({ duration, orElse: () => Stream.fail(error) })`.
- `Stream.retry(schedule)` reruns the whole stream and re-emits from the start. The schedule resets once a retry emits, so a stream that emits, then fails, retries forever. Retry the page fetch inside `paginate` instead.

## Fail review on

```ts
Stream.fromIterable(products).pipe(Stream.map(toSummary), Stream.runCollect);
tokens.pipe(Stream.timeout("30 seconds"));
Stream.runCollect(SubscriptionRef.changes(ref));
```

- An in-memory array. Write `products.map(toSummary)`.
- A stall reads as a clean end. Use `withDeadline` above.
- `changes` never ends, so this never returns. Use `Stream.runForEach` or `Stream.take(n)`.

## Upstream

`node_modules/effect/ai-docs/src/03_stream/10_creating-streams.ts`, `node_modules/effect/ai-docs/src/03_stream/20_consuming-streams.ts`, `node_modules/effect/ai-docs/src/03_stream/30_encoding.ts`
