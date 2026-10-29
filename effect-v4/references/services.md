# Services

Services, layers, config, and running a program.

## Service or function

**Use** a service when the code owns I/O, state, credentials, or policy. **Not** for pure work, a decoded value, or a forwarding wrapper — use a function.
**Why:** the deletion test. Delete the service. If no complexity moves into its callers, it was a function.

## Define

**Use** `class X extends Context.Service<X, {...}>()("@app/<area>/X") {}` and a free `xLayer` export. **Not** a v3 tag or accessor proxy — read [v3 traps](v3-traps.md).
**Why:** the class is the key, its shape is the contract, and `X.of` checks the implementation.

```ts
import { Context, Effect, Layer, Ref, Schema } from "effect";

export class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", {
  id: Schema.String,
}) {}
export interface Item {
  readonly id: string;
  readonly name: string;
}
export class ItemStore extends Context.Service<
  ItemStore,
  {
    get(id: string): Effect.Effect<Item, ItemMissing>;
    put(item: Item): Effect.Effect<void>;
  }
>()("@app/store/ItemStore") {}

export const itemStoreLayer = Layer.effect(
  ItemStore,
  Effect.gen(function* () {
    const items = yield* Ref.make(new Map<string, Item>());
    const get = Effect.fn("ItemStore.get")(function* (id: string) {
      const item = (yield* Ref.get(items)).get(id);
      if (item === undefined) return yield* new ItemMissing({ id });
      return item;
    });
    const put = Effect.fn("ItemStore.put")((item: Item) =>
      Ref.update(items, (map) => new Map(map).set(item.id, item)),
    );
    return ItemStore.of({ get, put });
  }),
);
```

- The key string is the runtime identity. A copied class that keeps the old key shares its slot.
- A zero-argument member is a property Effect: `readonly all: Effect.Effect<...>`. The language service flags `all: () => Effect`.

## Layer constructors

| Constructor                        | Use when                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Layer.succeed(X, X.of({...}))`    | the implementation is a ready value. Method I/O does not change that.                                                                                                                 |
| `Layer.sync(X, () => X.of({...}))` | construction is synchronous and runs at build time, not import time, such as creating an SDK client                                                                                   |
| `Layer.effect(X, Effect.gen(...))` | construction yields services, allocates state, or acquires resources. It removes `Scope`: an `Effect.acquireRelease` inside closes with the layer. Read [concurrency](concurrency.md) |
| `Layer.unwrap(effect)`             | an Effect, such as reading `Config` at the entry, decides the layer                                                                                                                   |
| `Layer.effectDiscard(effect)`      | the layer only starts background work and provides nothing; read [concurrency](concurrency.md)                                                                                        |

## Dependencies

**Use** `yield*` on each dependency once, in `Layer.effect`, and close over it. **Not** `yield*` inside a method.
**Why:** a method that yields a service puts it in every caller's `R`. Public methods have `R = never`.

```ts
import { Context, Effect, flow, Layer, type Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

export class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  cause: Schema.Defect(),
}) {}
const Product = Schema.Struct({ sku: Schema.String, priceCents: Schema.Int });
export class Catalog extends Context.Service<
  Catalog,
  {
    product(sku: string): Effect.Effect<typeof Product.Type, ProviderError>;
  }
>()("@app/catalog/Catalog") {}

export const catalogLayer = (input: {
  readonly baseUrl: string;
  readonly apiKey: Redacted.Redacted;
}) =>
  Layer.effect(
    Catalog,
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(
          flow(
            HttpClientRequest.prependUrl(input.baseUrl),
            HttpClientRequest.bearerToken(input.apiKey),
          ),
        ),
        HttpClient.filterStatusOk,
      );
      const product = Effect.fn("Catalog.product")(
        (sku: string) =>
          client
            .get(`/products/${sku}`)
            .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Product))),
        Effect.mapError((cause) => new ProviderError({ cause })),
      );
      return Catalog.of({ product });
    }),
  );
```

`catalogLayer` is `Layer<Catalog, never, HttpClient>`. The root provides `FetchHttpClient.layer`. Read [http](http.md).

## Factories share by identity

**Use** a factory `catalogLayer(input)` taking plain typed values. Call it once and share the result. **Not** one call per consumer.
**Why:** a layer builds once per graph, keyed by object identity. Each factory call is a new object, so it builds again.

```ts
import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer, Ref } from "effect";

class Pool extends Context.Service<Pool, { readonly id: number }>()("@app/db/Pool") {}
const poolLayer = (opened: Ref.Ref<number>) =>
  Layer.effect(
    Pool,
    Effect.map(
      Ref.updateAndGet(opened, (count) => count + 1),
      (id) => Pool.of({ id }),
    ),
  );
it.effect("shares one layer value, rebuilds each factory call", () =>
  Effect.gen(function* () {
    const opened = yield* Ref.make(0);
    const pool = poolLayer(opened);
    yield* Effect.provide(Effect.void, Layer.mergeAll(pool, pool));
    assert.strictEqual(yield* Ref.get(opened), 1);
    yield* Effect.provide(Effect.void, Layer.mergeAll(poolLayer(opened), poolLayer(opened)));
    assert.strictEqual(yield* Ref.get(opened), 3);
    yield* Effect.provide(Effect.void, Layer.mergeAll(pool, Layer.fresh(pool)));
    assert.strictEqual(yield* Ref.get(opened), 5);
  }),
);
```

- A nested `Effect.provide(layer)` reuses the build of the same layer object from an outer provide.
- **Isolate** with `Layer.fresh(layer)` or `Effect.provide(layer, { local: true })`: per-tenant state, a test that must not share a build. `fresh` rebuilds that one layer. `local` rebuilds the whole provided graph.

## Compose

| Combinator                      | Effect on the graph                                         |
| ------------------------------- | ----------------------------------------------------------- |
| `a.pipe(Layer.provide(b))`      | `b` satisfies `a`'s requirements and stays hidden           |
| `a.pipe(Layer.provideMerge(b))` | same, and `b` is also exposed; tests use it to `yield*` `b` |
| `Layer.mergeAll(a, b, c)`       | independent siblings, built concurrently                    |

- Provide shared infrastructure once, at the root: `Layer.mergeAll(itemStoreLayer, catalogLayer(input)).pipe(Layer.provide(FetchHttpClient.layer))`.
- Pipe the provides flat. Do not nest `Layer.provide(Layer.provide(...))`.

## Ambient settings

**Use** `Context.Reference<boolean>("@app/report/Verbose", { defaultValue: () => false })` for an ambient knob with a natural default: verbosity, a request tag. **Not** for business settings — those are required layer inputs.
**Why:** `yield* Verbose` has `R = never`. `Effect.provideService(Verbose, true)` overrides it for the wrapped effect.

## Config

**Use** `Config` only at the entry point. Pass the decoded values into layer factories. **Not** `Config` or `process.env` inside a service's layer.
**Why:** one place fails on a missing value, and layers stay host-independent and testable.

```ts
import { NodeRuntime } from "@effect/platform-node";
import { Config, Context, Effect, Layer, type Redacted } from "effect";

class Catalog extends Context.Service<Catalog, { readonly baseUrl: string }>()(
  "@app/catalog/Catalog",
) {}
const catalogLayer = (input: { readonly baseUrl: URL; readonly apiKey: Redacted.Redacted }) =>
  Layer.succeed(Catalog, Catalog.of({ baseUrl: input.baseUrl.href }));
const AppConfig = Config.all({
  baseUrl: Config.URL("CATALOG_BASE_URL"),
  apiKey: Config.Redacted("CATALOG_API_KEY"),
});
const AppLayer = Layer.unwrap(Effect.map(AppConfig, catalogLayer));
const program = Effect.flatMap(Catalog, (catalog) =>
  Effect.logInfo("catalog ready", catalog.baseUrl),
);
NodeRuntime.runMain(program.pipe(Effect.provide(AppLayer)));
```

| Need                    | Config                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| Text, required text     | `Config.String("X")`, `Config.NonEmptyString("X")`                     |
| Numbers, port, flag     | `Config.Int("X")`, `Config.Port("X")`, `Config.Boolean("X")`           |
| Duration, URL, secret   | `Config.Duration("X")`, `Config.URL("X")`, `Config.Redacted("X")`      |
| Choice, any schema      | `Config.Literals(["a", "b"], "X")`, `Config.schema(S, "X")`            |
| Group, optional, prefix | `Config.all({...})`, `Config.option(c)`, `c.pipe(Config.nested("DB"))` |

- An empty string counts as missing. `{ preserveEmptyStrings: true }` on the provider keeps it.
- `Config.withDefault` and `Config.option` cover only absence. A malformed value still fails.
- No `Config.withDefault` for business constants. Put constants in one config module.
- Provider `layerConfig` constructors (`SqliteClient.layerConfig`, `AnthropicClient.layerConfig`) read `Config` during the build, from env by default. Use `layer({...})` with values from the entry.
- **Redacted** prints `<redacted>` in logs, errors, and JSON. Call `Redacted.value(secret)` only at the call that needs the raw string. `HttpClientRequest.bearerToken` takes the `Redacted` itself.

**Test** config with `ConfigProvider.layer(ConfigProvider.fromUnknown({...}))`, never by mutating `process.env`.
`fromUnknown` nests by object: `Config.nested("DB")` reads `{ DB: { HOST } }`. `ConfigProvider.fromEnvRecord(record)` nests by name: `DB_HOST`.

```ts
import { assert, it } from "@effect/vitest";
import { Config, ConfigProvider, Effect, Option } from "effect";

const port = Config.option(Config.Port("PORT"));
const withEnv = (env: Record<string, string>) =>
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)));
it.effect("empty is missing, malformed fails", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(yield* port.pipe(withEnv({ PORT: "8080" })), Option.some(8080));
    assert.isTrue(Option.isNone(yield* port.pipe(withEnv({ PORT: "" }))));
    assert.strictEqual(
      (yield* port.pipe(withEnv({ PORT: "eighty" }), Effect.flip))._tag,
      "ConfigError",
    );
  }),
);
```

## Running

| Program                                            | Run it with                                                   |
| -------------------------------------------------- | ------------------------------------------------------------- |
| A job or CLI                                       | `NodeRuntime.runMain(program.pipe(Effect.provide(AppLayer)))` |
| A server or daemon modeled as layers               | `NodeRuntime.runMain(Layer.launch(AppLayer))`                 |
| Calls from a host framework (Hono, Express, React) | one `ManagedRuntime.make(AppLayer)` per process               |

**Use** `ManagedRuntime` to run many effects against one built graph. **Not** one runtime per service or per request.
**Why:** each runtime builds its own copy of every layer, including the shared infrastructure.

```ts
import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

class Pool extends Context.Service<Pool, { query(sql: string): Effect.Effect<string> }>()(
  "@app/db/Pool",
) {}
const events: Array<string> = [];
const poolLayer = Layer.effect(
  Pool,
  Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => events.push("open")),
      () => Effect.sync(() => events.push("close")),
    );
    return Pool.of({
      query: Effect.fn("Pool.query")((sql: string) => Effect.succeed(`ran ${sql}`)),
    });
  }),
);
it("runs effects on one runtime, then disposes it", async () => {
  const runtime = ManagedRuntime.make(poolLayer);
  assert.strictEqual(
    await runtime.runPromise(Pool.use((pool) => pool.query("select 1"))),
    "ran select 1",
  );
  await runtime.dispose();
  assert.deepStrictEqual(events, ["open", "close"]);
});
```

- `X.use((x) => x.method())` is one call from outside `Effect.gen`. Inside a generator, write `const x = yield* X`.
- `runMain` interrupts on `SIGINT` and `SIGTERM`, runs finalizers, and sets the exit code.
- Dispose the runtime on shutdown. A disposed runtime cannot run again.

## Fail review on

```ts
class Catalog extends Context.Service<
  Catalog,
  { product(sku: string): Effect.Effect<Product, ProviderError, HttpClient.HttpClient> }
>()("Catalog") {}
const AppLayer = Layer.mergeAll(
  catalogLayer(input),
  searchLayer.pipe(Layer.provide(catalogLayer(input))),
);
const apiKey = process.env.CATALOG_API_KEY ?? "dev-key";
const sqlLayer = SqliteClient.layerConfig({ filename: Config.String("DB_PATH") });
const storeRuntime = ManagedRuntime.make(itemStoreLayer);
```

- Yield `HttpClient.HttpClient` once in `Layer.effect` so the method has `R = never`. Key it `"@app/catalog/Catalog"`.
- Bind `const catalog = catalogLayer(input)` once and share it.
- Read config at the entry, with no fallback.
- `SqliteClient.layer({ filename })` with the value from the entry.
- One `ManagedRuntime.make(AppLayer)` per process.

## Upstream

`node_modules/effect/ai-docs/src/01_effect/03_services/01_service.ts`, `node_modules/effect/ai-docs/src/01_effect/03_services/20_layer-composition.ts`, `node_modules/effect/ai-docs/src/04_integration/10_managed-runtime.ts`
