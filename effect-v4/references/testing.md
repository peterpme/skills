# Testing

Tests that catch real regressions: seams, runners, errors, time, concurrency, properties, proof.

## Start

Name the regression first: the wrong implementation this test rejects.
Pick the smallest real seam that catches it. One level per changed behavior.

| Code under test         | Real seam                                                | Runner                         |
| ----------------------- | -------------------------------------------------------- | ------------------------------ |
| Pure function           | Plain values in and out                                  | `it`, `it.prop`                |
| Decoding a response     | A recorded fixture through the production schema         | `it.effect`                    |
| Storage                 | SQLite `:memory:` under the production layer             | `it.effect` + `Effect.provide` |
| Files                   | `fs.makeTempDirectoryScoped()` with `NodeServices.layer` | `it.effect`                    |
| Time, retries, timeouts | `TestClock.adjust`                                       | `it.effect`                    |
| HTTP adapter            | A real local server from `NodeHttpServer.layerTest`      | `it.effect`                    |
| Workflow                | The project's end-to-end command                         | not a unit test                |

## Runners

**`it.effect`** provides `Scope`, `TestClock`, and `TestConsole`. Time is virtual and starts at `0`.
**`it.live`** provides `Scope` and the real clock. Use it only when wall time is the subject.
**`Effect.provide(L)`** inside a test builds `L` for that test. This is the default.
**`layer(L)("suite", (it) => ...)`** builds `L` once for the block. Only for an expensive real resource.

**Gotchas**

- An un-advanced `Effect.sleep` in `it.effect` hangs. The log says the test clock is not advancing.
- A `layer(L)` block shares state and one `TestClock` across its tests. Each test creates its own rows.

## Pure code

**Use** plain `it` for a pure function. **Not** `it.effect` around `Effect.succeed`.
**Use** a recorded response through the production schema. **Not** a fixture typed from memory.
**Use** `it.prop(name, [Schema], f)` for an invariant: round trip, idempotence, order.
`it.effect.prop` runs an Effect. Throw, fail, or return `false` to falsify.
**Why:** real responses carry the `null` you forgot. Schemas generate the cases you did not list.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

const Cents = Schema.Int.check(Schema.isGreaterThan(0));
const Product = Schema.Struct({
  id: Schema.String,
  priceCents: Cents,
  endedAt: Schema.NullOr(Schema.String),
});
const ProductPage = Schema.fromJsonString(Schema.Struct({ products: Schema.Array(Product) }));
const recordedPage = `{"products":[{"id":"p1","priceCents":250,"endedAt":null,"rank":4}]}`;

const byPrice = (products: ReadonlyArray<typeof Product.Type>) =>
  [...products].sort((a, b) => a.priceCents - b.priceCents);

it.effect("decodes a null endedAt and drops unknown fields", () =>
  Effect.gen(function* () {
    const page = yield* Schema.decodeEffect(ProductPage)(recordedPage);
    assert.deepStrictEqual(page.products, [{ id: "p1", priceCents: 250, endedAt: null }]);
  }),
);

it.prop("byPrice is idempotent", [Schema.Array(Product)], ([products]) => {
  assert.deepStrictEqual(byPrice(byPrice(products)), byPrice(products));
});

it.effect.prop("a page survives the JSON codec", [Schema.toType(ProductPage)], ([page]) =>
  Effect.gen(function* () {
    const text = yield* Schema.encodeEffect(ProductPage)(page);
    assert.deepStrictEqual(yield* Schema.decodeEffect(ProductPage)(text), page);
  }),
);
```

**Gotchas**

- Generation is native. Do not install or import fast-check.
- `Schema.Int` generates `-0`. JSON returns `0`, and `deepStrictEqual` fails. Constrain the schema.

## Typed failures

**Use** `Effect.flip` to get the error. Assert `_tag` and the fields callers read.
**Use** `Effect.exit` for defects and interruption: `Exit.hasDies(yield* Effect.exit(run))`, `Exit.hasInterrupts`.
**Not** a snapshot of the whole `Cause` or error. It breaks on refactors and proves nothing.
**Why:** the tag and fields are the contract a `catchTag` branches on.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", { id: Schema.String }) {}
const stock: ReadonlyMap<string, number> = new Map([["p1", 3]]);

const reserve = Effect.fn("Catalog.reserve")(function* (id: string, quantity: number) {
  const available = stock.get(id);
  if (available === undefined) return yield* new ItemMissing({ id });
  return available - quantity;
});

it.effect("fails with ItemMissing for an unknown id", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(reserve("p9", 1));
    assert.strictEqual(error._tag, "ItemMissing");
    assert.strictEqual(error.id, "p9");
  }),
);
```

## Time

**Use** fork, then `TestClock.adjust`, then `Fiber.join`. **Not** `it.live` with real sleeps.
**Why:** the attempt count and each delay become exact assertions.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Ref, Schedule, Schema } from "effect";
import { TestClock } from "effect/testing";

class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  retryable: Schema.Boolean,
}) {}

const providerRetry = {
  times: 3,
  schedule: Schedule.exponential("1 second"),
  while: (e: ProviderError) => e.retryable,
};

it.effect("backs off 1s, 2s, 4s, then surfaces the last error", () =>
  Effect.gen(function* () {
    const attempts = yield* Ref.make(0);
    const call = Ref.update(attempts, (n) => n + 1).pipe(
      Effect.andThen(new ProviderError({ retryable: true })),
    );
    const fiber = yield* Effect.forkChild(Effect.flip(Effect.retry(call, providerRetry)));
    yield* TestClock.adjust("3 seconds");
    assert.strictEqual(yield* Ref.get(attempts), 3);
    yield* TestClock.adjust("4 seconds");
    assert.strictEqual((yield* Fiber.join(fiber))._tag, "ProviderError");
    assert.strictEqual(yield* Ref.get(attempts), 4);
  }),
);

it.effect("does not retry a permanent error", () =>
  Effect.gen(function* () {
    const attempts = yield* Ref.make(0);
    const call = Ref.update(attempts, (n) => n + 1).pipe(
      Effect.andThen(new ProviderError({ retryable: false })),
    );
    yield* Effect.flip(Effect.retry(call, providerRetry));
    assert.strictEqual(yield* Ref.get(attempts), 1);
  }),
);
```

**Gotchas**

- Fork before `adjust`. A sleep on the test fiber blocks the `adjust` forever.
- `times: 3` is three retries, four attempts.

## Concurrency

**Use** fork, await a `Deferred` or `Latch`, then act and assert. **Not** `Effect.sleep` and hope.
**Why:** a readiness signal fixes the order. A sleep races the scheduler.

```ts
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";

const holdLock = Effect.fn("ItemLock.hold")(function* (
  lockPath: string,
  held: Deferred.Deferred<void>,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.acquireRelease(fs.writeFileString(lockPath, "held"), () =>
    Effect.orDie(fs.remove(lockPath)),
  );
  yield* Deferred.succeed(held, undefined);
  return yield* Effect.never;
}, Effect.scoped);

it.effect("interrupting the holder removes the lock file", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const lockPath = (yield* Path.Path).join(yield* fs.makeTempDirectoryScoped(), "item.lock");
    const held = yield* Deferred.make<void>();
    const fiber = yield* Effect.forkChild(holdLock(lockPath, held));
    yield* Deferred.await(held);
    assert.isTrue(yield* fs.exists(lockPath));
    yield* Fiber.interrupt(fiber);
    assert.isFalse(yield* fs.exists(lockPath));
  }).pipe(Effect.provide(NodeServices.layer)),
);
```

## Real seams

**Use** the production layer over `SqliteClient.layer({ filename: ":memory:" })`. **Not** a `Ref` or `Map` with the same methods.
**Use** `NodeHttpServer.layerTest` for an HTTP adapter: a real server on port 0. `HttpServer.serveEffect(handler)` serves a recorded response.
**Why:** only the real thing has `NULL`, constraints, status codes, and encoding. A fake proves the fake.
**The story.** A `Ref` store held `{ id: "p1" }` with no `note` key. Every test passed. Production failed.
SQLite returns `note: null`, and `Schema.optionalKey` rejects `null`. A SQLite test catches it. Use `Schema.NullOr`.
Create tables with the project's real migrations. Full examples: [sql](sql.md#store), [http](http.md#testing).

## Proof

A workflow change is proven by the project's end-to-end command. Show its output beside the source.
Tests, lint, and typecheck are supporting evidence. Say what stays unverified.
Do not unit-test host glue. Do not call back into the host runtime from a test.

## Fail review on

```ts
vi.mock("./item-store.ts", () => ({ findItem: vi.fn(() => Effect.succeed(item)) }));
const fakeStore = Layer.succeed(ItemStore, ItemStore.of({ list: Effect.succeed([item]) }));
const partialStore = Layer.mock(ItemStore)({ list: Effect.succeed([item]) });
const refStore = Layer.effect(ItemStore, Ref.make([item]).pipe(Effect.map(storeOverRef)));
```

A mock or fake proves itself. It never returns `NULL`. Test the pure function or the production layer.
Upstream `ai-docs/src/09_testing/20_layer-tests.ts` teaches the `Ref` version. Do not copy it.

```ts
Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) => Effect.succeed(cannedResponse)),
);
```

A stub skips encoding, status handling, and decoding. Use `NodeHttpServer.layerTest`.

## Review

- The test name states the regression. No regression → delete the test.
- `vi.mock`, `Layer.mock`, `Layer.succeed` or `.of` of an app service, `HttpClient.make` → reject.
- `Effect.sleep` or `setTimeout` to wait for another fiber → reject. Await a `Deferred`.
- `it.live` without wall time as the subject → reject.
- A whole `Cause` or error snapshot → reject. Assert `_tag` and fields.
- A fixture written from the type, not recorded → reject.
- A retry test that does not count attempts → reject.

## Upstream

`node_modules/effect/ai-docs/src/09_testing/10_effect-tests.ts`, `node_modules/@effect/vitest/src/index.ts`
