# Caching

In-memory memoization, keyed caches, and request batching.

## Which one

| Need                               | Use                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------- |
| One value, refreshed after a TTL   | `Effect.cachedWithTTL(load, ttl)`                                       |
| One value plus a manual reset      | `Effect.cachedInvalidateWithTTL(load, ttl)` → `[cached, invalidate]`    |
| One value that never changes       | `Effect.cached(load)`                                                   |
| Many keys                          | `Cache.makeWith(lookup, { capacity, timeToLive })`                      |
| Keyed values that own a resource   | `ScopedCache.make({ capacity, lookup, timeToLive })` (needs a `Scope`)  |
| N lookups served by one batch call | `Request` + `RequestResolver` + `Effect.request`                        |
| A cache that survives a restart    | `PersistedCache` from `effect/persistence`. Read [modules](modules.md). |

## Memoize one effect

**Use** `Effect.cachedWithTTL` for one shared value: an access token, a remote settings document. **Not** `Effect.cached` for anything that expires — it keeps the first `Exit` forever.
**Why:** concurrent callers share the in-flight run. The TTL bounds staleness.

```ts
import { Context, Duration, Effect, Exit, Layer, Schema } from "effect";

class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  message: Schema.String,
}) {}
class AuthApi extends Context.Service<
  AuthApi,
  { readonly issueToken: Effect.Effect<string, ProviderError> }
>()("@app/provider/AuthApi") {}
class Tokens extends Context.Service<
  Tokens,
  { readonly current: Effect.Effect<string, ProviderError> }
>()("@app/auth/Tokens") {}

export const tokensLayer = Layer.effect(
  Tokens,
  Effect.gen(function* () {
    const api = yield* AuthApi;
    const current = yield* Effect.cachedWithTTL(api.issueToken, (exit) =>
      Exit.isSuccess(exit) ? "50 minutes" : Duration.zero,
    );
    return Tokens.of({ current });
  }),
);
```

**Gotchas**

- `Effect.cached` keeps a failure, and an interrupted first run, forever.
- `cachedInvalidateWithTTL` takes a fixed TTL only. A failure stays until `invalidate` or expiry.

## Keyed cache

**Use** `Cache.makeWith(lookup, { capacity, timeToLive })` for expensive lookups by key. **Not** `Cache.make` without `timeToLive` — it caches failures forever.
**Why:** `capacity` bounds memory. Concurrent `get`s for one key share one lookup.
`Cache.get` reads or loads. `Cache.set`, `invalidate`, `invalidateAll`, and `refresh` (reload, reset TTL) change entries.

```ts
import { assert, it } from "@effect/vitest";
import { Cache, Duration, Effect, Exit, Ref, Schema } from "effect";

class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  message: Schema.String,
}) {}

it.effect("a failed lookup is not cached", () =>
  Effect.gen(function* () {
    const calls = yield* Ref.make(0);
    const cache = yield* Cache.makeWith(
      (key: { readonly tenantId: string; readonly itemId: string }) =>
        Ref.updateAndGet(calls, (n) => n + 1).pipe(
          Effect.flatMap((n) =>
            n === 1
              ? Effect.fail(new ProviderError({ message: "busy" }))
              : Effect.succeed(key.itemId),
          ),
        ),
      {
        capacity: 1000,
        timeToLive: (exit) => (Exit.isSuccess(exit) ? "5 minutes" : Duration.zero),
      },
    );
    const key = { tenantId: "t1", itemId: "i1" };
    assert.isTrue(Exit.isFailure(yield* Effect.exit(Cache.get(cache, key))));
    assert.strictEqual(yield* Cache.get(cache, key), "i1");
    assert.strictEqual(yield* Cache.get(cache, { tenantId: "t1", itemId: "i1" }), "i1");
    assert.strictEqual(yield* Ref.get(calls), 2);
  }),
);
```

**Gotchas**

- `makeWith` takes `lookup` first, positionally. `make` takes it inside the options.
- `Cache.make`'s fixed `timeToLive` applies to failures too. One error fails every `get` until it expires.
- Build it once in `Layer.effect`: `const prices = yield* Cache.makeWith(api.price, { ... })`. A cache built per call never hits.
- The key holds everything that changes the answer: tenant, auth scope, locale, representation. A plain object such as `{ tenantId, itemId }` compares by value.

## Batching

**Use** `RequestResolver.make` when concurrent lookups can share one real batch endpoint (`GET /items?ids=`, `WHERE id IN`). **Not** when the provider has no batch call — use `Effect.forEach(ids, get, { concurrency })` with a `Cache`.
**Why:** requests issued together reach the resolver as one batch. N calls become one.

```ts
import { Context, Effect, Exit, Layer, Request, RequestResolver, Schema } from "effect";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", { id: Schema.String }) {}
class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  message: Schema.String,
}) {}
class GetItem extends Request.Class<{ readonly id: string }, Item, ItemMissing | ProviderError> {}

class ItemApi extends Context.Service<
  ItemApi,
  {
    readonly getMany: (
      ids: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<Item>, ProviderError>;
  }
>()("@app/provider/ItemApi") {}
class Items extends Context.Service<
  Items,
  {
    readonly get: (id: string) => Effect.Effect<Item, ItemMissing | ProviderError>;
  }
>()("@app/catalog/Items") {}

export const itemsLayer = Layer.effect(
  Items,
  Effect.gen(function* () {
    const api = yield* ItemApi;
    const resolver = RequestResolver.make<GetItem>(
      Effect.fn("Items.getBatch")(function* (entries) {
        const found = yield* api.getMany([...new Set(entries.map((entry) => entry.request.id))]);
        const byId = new Map(found.map((item) => [item.id, item]));
        for (const entry of entries) {
          const item = byId.get(entry.request.id);
          entry.completeUnsafe(
            item ? Exit.succeed(item) : Exit.fail(new ItemMissing({ id: entry.request.id })),
          );
        }
      }),
    ).pipe(RequestResolver.setDelay("10 millis"), RequestResolver.batchN(100));
    const get = Effect.fn("Items.get")((id: string) =>
      Effect.request(new GetItem({ id }), resolver),
    );
    return Items.of({ get });
  }),
);
```

**Gotchas**

- Only concurrent requests batch: `Effect.forEach(ids, items.get, { concurrency: "unbounded" })`. A sequential loop sends batches of one.
- A batch can repeat an id. Dedupe before the call. `RequestResolver.withCache` dedupes too, but never expires and caches failures.
- Complete every entry. A missed entry dies. A failed batch call fails every pending entry.
- `batchN(n)` caps the batch at the endpoint's limit. `setDelay` widens the collection window.

## Fail review on

<!-- prettier-ignore -->
```ts
const cache = yield* Cache.make({ capacity: 1000, lookup: catalog.price })
```

Use `makeWith` with `Duration.zero` for failures. Without a TTL, a failure is cached forever.

```ts
const price = Effect.fn("Prices.get")(function* (itemId: string) {
  const cache = yield* Cache.make({
    capacity: 1000,
    lookup: catalog.price,
    timeToLive: "5 minutes",
  });
  return yield* Cache.get(cache, itemId);
});
```

Build caches and memos once in `Layer.effect` and close over them. A per-call cache never hits.

## Upstream

`node_modules/effect/ai-docs/src/05_batching/10_request-resolver.ts`, `node_modules/effect/src/Cache.ts`
