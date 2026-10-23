# Concurrency

Parallel work, fibers, scopes, shared state, and coordination primitives.

| I need                                  | Use                                                       |
| --------------------------------------- | --------------------------------------------------------- |
| I/O per item, or a few effects at once  | `Effect.forEach(xs, f, { concurrency: n })`, `Effect.all` |
| A resource that must be closed          | `Effect.acquireRelease`                                   |
| A loop that runs as long as the app     | `Effect.forkScoped` in a layer. Other forks are rare.     |
| One value from a callback API           | `Effect.callback`                                         |
| State, a signal, a gate, a shared limit | `Ref`, `Deferred`, `Latch`, `Semaphore`                   |
| Work handed to consumers                | `Queue`, `PubSub`                                         |

## Parallel work

**Use** `Effect.forEach(xs, f, { concurrency: n })` when each item needs I/O. **Not** when `f` is pure — use `xs.map(f)`.
**Use** `Effect.all({ a, b }, { concurrency: n })` for a fixed set of different effects. Tuples work too.
**Why:** one number caps the load. Results keep input order. The first failure interrupts the rest.

```ts
import { Effect, Schema } from "effect";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", { id: Schema.String }) {}
declare const loadItem: (id: string) => Effect.Effect<Item, ItemMissing>;

export const loadItems = Effect.fn("ItemStore.loadItems")((ids: ReadonlyArray<string>) =>
  Effect.forEach(ids, loadItem, { concurrency: 4 }),
);
export const loadPair = Effect.fn("ItemStore.loadPair")((first: string, second: string) =>
  Effect.all({ first: loadItem(first), second: loadItem(second) }, { concurrency: 2 }),
);
```

Default is sequential. `"unbounded"` only for short, fixed lists. `discard: true` returns `void`. `Effect.all` with `mode: "result"` returns a `Result` per entry.

**Race** with `Effect.race(a, b)` or `Effect.raceAll([a, b, c])` for the first success, as in hedged calls. Early failures do not end the race. `Effect.raceFirst` and `Effect.raceAllFirst` take the first to finish, success or failure. Losers are interrupted. **Not** for a deadline — use `Effect.timeoutOrElse` ([time](time.md)).

## Fibers

**Use** a fork when work must run while the current fiber continues: a layer loop, a test you interrupt. **Not** for parallel lists — use `forEach` with `concurrency`.
**Why:** `forEach` and `all` already join, interrupt, and propagate errors. A raw fiber does none of that.

| Fork                              | Fiber lives until                                | Use for                                                            |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `Effect.forkChild`                | the parent fiber ends                            | concurrent work inside one operation; `Effect.fork` does not exist |
| `Effect.forkScoped`               | the enclosing `Scope` closes                     | loops owned by a layer                                             |
| `Effect.forkIn(scope)`            | that `scope` closes                              | a `Scope` you hold as a value                                      |
| `Effect.forkDetach`               | it ends; no parent or scope interrupts it        | rare fire-and-forget; log its failure                              |
| `FiberSet.run(set, effect)`       | the set's scope closes                           | many children a service starts at run time                         |
| `FiberMap.run(map, key, effect)`  | the map's scope closes; a rerun replaces the key | one job per key; `{ onlyIfMissing: true }` keeps the old           |
| `FiberHandle.run(handle, effect)` | the handle's scope closes; a rerun replaces it   | one latest job                                                     |

`Fiber.join(fiber)` returns `A` or fails with `E`. `Fiber.await(fiber)` returns the `Exit`. `Fiber.interrupt(fiber)` waits for finalizers.
`FiberSet.make()`, `FiberMap.make()`, and `FiberHandle.make()` require a `Scope`; call them in `Layer.effect`. `FiberSet.join(set)` fails with the first child failure, else waits for the set to close. `FiberSet.awaitEmpty(set)` waits for the running children.
`Effect.uninterruptible(effect)` finishes once started. `Effect.uninterruptibleMask((restore) => ...)` reopens interruption inside `restore`.

**Gotchas**

- `forkChild`, `forkScoped`, `forkIn`, and `forkDetach` start the fiber at the parent's next yield. Pass `{ startImmediately: true }` to start it at the fork. `FiberSet.run` starts at once.
- A forked fiber's failure is silent unless joined. Add `Effect.tapCause(Effect.logError)` before the fork. It does not log interruption.

**Test** a fiber by awaiting a `Deferred` it completes before `TestClock.adjust` or `Fiber.interrupt`. `Effect.sleep` blocks until `TestClock.adjust`.

```ts
import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Ref } from "effect";

it.effect("interrupting a fiber runs its finalizer", () =>
  Effect.gen(function* () {
    const ready = yield* Deferred.make<void>();
    const released = yield* Ref.make(false);
    const fiber = yield* Effect.gen(function* () {
      yield* Effect.addFinalizer(() => Ref.set(released, true));
      yield* Deferred.succeed(ready, undefined);
      return yield* Effect.never;
    }).pipe(Effect.scoped, Effect.forkChild);
    yield* Deferred.await(ready);
    yield* Fiber.interrupt(fiber);
    assert.isTrue(yield* Ref.get(released));
  }),
);
```

## Resources

**Use** `Effect.acquireRelease(acquire, release)` for anything that must be closed. **Not** a `close()` call after the work — a failure or interruption skips it.
**Why:** release runs on success, failure, and interruption. Acquisition is uninterruptible.

```ts
import { Context, Effect, Layer, Schema } from "effect";

declare const openSdkClient: (url: string) => {
  stock: (id: string) => Promise<number>;
  close: () => Promise<void>;
};
class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  cause: Schema.Defect(),
}) {}
class ItemStore extends Context.Service<
  ItemStore,
  { readonly stock: (id: string) => Effect.Effect<number, StoreError> }
>()("@app/store/ItemStore") {}

export const itemStoreLayer = (input: { readonly url: string }) =>
  Layer.effect(
    ItemStore,
    Effect.gen(function* () {
      const client = yield* Effect.acquireRelease(
        Effect.sync(() => openSdkClient(input.url)),
        (client) =>
          Effect.tryPromise({
            try: () => client.close(),
            catch: (cause) => new StoreError({ cause }),
          }).pipe(
            Effect.catchTag("StoreError", (error) =>
              Effect.logWarning("close failed", error.cause),
            ),
          ),
      );
      return ItemStore.of({
        stock: Effect.fn("ItemStore.stock")((id: string) =>
          Effect.tryPromise({
            try: () => client.stock(id),
            catch: (cause) => new StoreError({ cause }),
          }),
        ),
      });
    }),
  );
```

- `Layer.effect` closes the client when the layer is released. `Effect.scoped(effect)` closes when `effect` ends: a resource for one operation.
- `Effect.addFinalizer((exit) => effect)` adds cleanup with no resource. Prefer built-in scoped constructors: `fs.makeTempDirectoryScoped()`, `PubSub.subscribe`.
- `Effect.acquireUseRelease(acquire, use, release)` scopes the resource to `use`. Its release can fail with a typed error. `acquireRelease`'s release has `E = never`.
- `Pool.make({ acquire, size })` for N interchangeable connections, one per caller. Borrow with `Pool.get(pool)`; it returns when the `Scope` closes.
- `RcRef.make({ acquire, idleTimeToLive })` for one costly client used now and then. `RcMap.make({ lookup, idleTimeToLive })` keeps one per key. An always-on client is a plain layer.

## Background loop

**Use** `Effect.forkScoped` inside a layer for a loop that lives as long as the app. **Not** a loop the layer awaits — the layer never finishes building.
**Why:** the layer returns at once. Disposal interrupts the loop and drops queued items.

```ts
import { Context, Effect, Layer, Queue, Schema } from "effect";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
declare const indexItem: (item: Item) => Effect.Effect<void>;
class ItemIndexer extends Context.Service<
  ItemIndexer,
  { readonly enqueue: (item: Item) => Effect.Effect<boolean> }
>()("@app/search/ItemIndexer") {}

export const itemIndexerLayer = (input: { readonly capacity: number }) =>
  Layer.effect(
    ItemIndexer,
    Effect.gen(function* () {
      const queue = yield* Queue.bounded<Item>(input.capacity);
      yield* Queue.take(queue).pipe(
        Effect.flatMap(indexItem),
        Effect.forever,
        Effect.tapCause(Effect.logError),
        Effect.forkScoped,
      );
      return ItemIndexer.of({
        enqueue: Effect.fn("ItemIndexer.enqueue")((item: Item) => Queue.offer(queue, item)),
      });
    }),
  );
```

- A failure ends `Effect.forever`. Handle per-item errors inside the loop body, or one bad item stops the loop.
- A loop with no service is `Layer.effectDiscard(loop.pipe(Effect.forkScoped))`. A periodic loop repeats with `Schedule.spaced` ([time](time.md)).

## Callback APIs

**Use** `Effect.callback((resume, signal) => cleanup)` for one callback or event. **Not** for many values — use `Stream.callback` ([streams](streams.md)).
**Why:** interruption runs the returned cleanup, so listeners never leak.

```ts
import { Effect } from "effect";
import type { EventEmitter } from "node:events";

export const nextItemId = Effect.fn("ItemFeed.next")((feed: EventEmitter) =>
  Effect.callback<string>((resume) => {
    const onItem = (id: string) => resume(Effect.succeed(id));
    feed.once("item", onItem);
    return Effect.sync(() => feed.off("item", onItem));
  }),
);
```

Call `resume` once. The cleanup runs only on interruption: a handler that resumes removes sibling listeners itself. Pass `signal` to APIs that take an `AbortSignal`.

## State and signals

**Use** these inside a service, created in its layer. **Not** a module-level `let` — every runtime and test shares it.
**Why:** updates are atomic across fibers. State dies with the layer.

| Need                                      | Use                                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| State with pure updates                   | `Ref.make(0)`, `Ref.update(ref, f)`, `Ref.modify(ref, f)`                                          |
| Updates that run an effect, one at a time | `SynchronizedRef.updateEffect(ref, (a) => effect)`                                                 |
| State others watch                        | `SubscriptionRef.changes(ref)`: a `Stream` of the current value, then each change                  |
| One value or failure for waiters          | `Deferred.make<A, E>()`, `Deferred.succeed`, `Deferred.await`                                      |
| A gate that opens and closes              | `Latch.make()` starts closed. `latch.open`, `latch.close`, `latch.await`, `latch.whenOpen(effect)` |
| One limit shared by many callers          | `Semaphore.make(n)` in the layer, then `Effect.fn("X.y")(body, semaphore.withPermits(1))`          |

`Effect.makeSemaphore` and `Effect.makeLatch` do not exist. A limit at one call site is `forEach` `concurrency`, not a `Semaphore`.

## Queues and PubSub

**Use** `Queue` when each item goes to one consumer. **Use** `PubSub` when every subscriber gets every item. **Not** for a list you already hold — use `forEach` with `concurrency`.
**Why:** a bounded queue caps queued work. `concurrency` caps only active work.

| Constructor         | When full                               |
| ------------------- | --------------------------------------- |
| `Queue.bounded(n)`  | `offer` waits                           |
| `Queue.dropping(n)` | `offer` returns `false`; old items stay |
| `Queue.sliding(n)`  | the oldest item is dropped              |
| `Queue.unbounded()` | never full; memory grows                |

- `Queue.take` waits for one item. `Queue.takeAll` waits for one, then returns all buffered. `Queue.shutdown` drops buffered items and interrupts waiters.
- `Queue.end(queue)` lets consumers drain, then `take` fails with `Cause.Done`. Type it `Queue.bounded<A, Cause.Done>(n)`.
- `PubSub.subscribe(pubsub)` requires a `Scope`. Subscribe before publishing; earlier messages are lost. `PubSub.bounded({ capacity, replay })` replays the last `replay` messages to late subscribers.

## Fail review on

<!-- prettier-ignore -->
```ts
yield* Effect.forEach(allItems, saveItem, { concurrency: "unbounded" })
yield* syncLoop.pipe(Effect.forkDetach)
```

- Unbounded fan-out over input you do not control. Set a number.
- An unowned, unlogged fiber. Fork it with `Effect.forkScoped` in a layer, after `Effect.tapCause(Effect.logError)`.

## Upstream

`node_modules/effect/ai-docs/src/01_effect/05_resources/10_acquire-release.ts`, `node_modules/effect/ai-docs/src/01_effect/05_resources/20_layer-side-effects.ts`, `node_modules/effect/ai-docs/src/01_effect/07_pubsub/10_pubsub.ts`
