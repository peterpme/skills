# Modules

What each less common module solves, when to reach for it, and the simpler thing to use instead.

Most of `effect/<area>` is `@stability unstable`. It runs in production, but a 4.x minor can break it.
Read the module header in `node_modules/effect/src/<area>/` before trusting memory.

## Which one

| You need                                      | Use                           | Simpler first                          |
| --------------------------------------------- | ----------------------------- | -------------------------------------- |
| Typed calls between your own TS processes     | `effect/rpc`                  | `HttpApi` for public or non-TS clients |
| A multi-step job that resumes after a crash   | `effect/workflow`             | `Effect.retry` for one call            |
| One live owner per id across machines         | `effect/cluster`              | `Semaphore` inside one process         |
| Data or jobs that outlive the process         | `effect/persistence`          | `Cache`, `Queue` in memory             |
| Re-run reads after a write                    | `Reactivity`                  | Call the read again                    |
| UI state backed by Effects                    | `Atom` + `@effect/atom-react` | Server-rendered data                   |
| Offline-first sync of an event journal        | `effect/eventlog`             | SQL rows                               |
| One row with insert, update, and JSON shapes  | `Model` from `effect/schema`  | `Schema.Class`                         |
| Atomic change across several in-memory values | `TxRef` + `Effect.tx`         | One `Ref`                              |
| A layer per key, such as per tenant           | `LayerMap`                    | One layer                              |
| N reusable connections                        | `Pool`                        | One client in a layer                  |
| A per-key resource released when idle         | `RcMap`                       | `Cache` for plain values               |
| Dependency order or shortest paths            | `Graph`                       | A `Map` for one-hop lookups            |
| Calendar schedules                            | `Cron`, `Schedule.cron`       | `Schedule.spaced`                      |
| Fall back across providers                    | `ExecutionPlan`               | `Effect.catch` to one fallback         |

## RPC

**What:** typed function calls between your own processes. Errors and streams survive the wire.
**Use** when your own TS client, worker thread, or daemon calls your server. **Not** for public, curl-able, or non-TS clients — use `HttpApi` ([http](http.md)). **Not** for a webhook — use `HttpRouter`.
**Why:** one contract gives decoded payloads, client methods, typed errors, and `Stream` results.
Key APIs: `Rpc.make(tag, { payload, success, error, stream })`, `RpcGroup.make(...)`, `group.toLayer(handlers)`, `RpcTest.makeClient(group)`.
Serve with `RpcServer.layerHttp({ group, path, protocol: "http" })` plus `RpcSerialization.layerNdjson`. Without `protocol` it serves WebSocket.
Call with `RpcClient.make(group)` over `RpcClient.layerProtocolHttp({ url })`.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", { id: Schema.String }) {}

class ItemRpcs extends RpcGroup.make(
  Rpc.make("GetItem", { payload: { id: Schema.String }, success: Item, error: ItemMissing }),
  Rpc.make("ListItems", { success: Item, stream: true }),
) {}

const itemRpcsLayer = ItemRpcs.toLayer(
  Effect.sync(() => {
    const items = new Map([["a", new Item({ id: "a", name: "Lamp" })]]);
    const GetItem = Effect.fn("ItemRpcs.GetItem")(function* ({ id }: { readonly id: string }) {
      const item = items.get(id);
      if (item === undefined) return yield* new ItemMissing({ id });
      return item;
    });
    return ItemRpcs.of({ GetItem, ListItems: () => Stream.fromIterable(items.values()) });
  }),
);

it.effect("returns values, typed errors, and streams", () =>
  Effect.gen(function* () {
    const client = yield* RpcTest.makeClient(ItemRpcs);
    assert.strictEqual((yield* client.GetItem({ id: "a" })).name, "Lamp");
    const missing = yield* client.GetItem({ id: "z" }).pipe(Effect.flip);
    assert.strictEqual(missing._tag, "ItemMissing");
    const listed = yield* client.ListItems().pipe(Stream.runCollect);
    assert.deepStrictEqual(
      listed.map((item) => item.id),
      ["a"],
    );
  }).pipe(Effect.provide(itemRpcsLayer)),
);
```

Transport and serialization are separate layers. Swap HTTP for WebSocket or a worker without touching handlers.
**Read:** `node_modules/effect/src/rpc/RpcGroup.ts`, `RpcServer.ts`, `RpcClient.ts`.

## Workflow

**What:** a multi-step function that survives a crash or a restart. Each side effect is an `Activity`.
**Use** when steps must not repeat: charge, then ship, then wait days for approval. **Not** for one retryable call — use `Effect.retry` ([time](time.md)). **Not** for a job queue — use `PersistedQueue`.
**Why:** the engine records each finished `Activity`, so a resumed run skips it.
Key APIs: `Workflow.make(tag, { payload, success, error, idempotencyKey })`, `workflow.toLayer(body)`, `workflow.execute(payload)`, `workflow.poll(executionId)`, `Activity.make({ name, success, error, execute })`.
Waiting: `DurableClock.sleep({ name, duration })` sleeps for days. `DurableDeferred.await(deferred)` parks until `DurableDeferred.succeed` completes it.

```ts
import { assert, layer } from "@effect/vitest";
import { Clock, Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";
import { Activity, Workflow, WorkflowEngine } from "effect/workflow";

class PaymentDeclined extends Schema.TaggedError<PaymentDeclined>()("PaymentDeclined", {
  orderId: Schema.String,
}) {}

const Checkout = Workflow.make("Checkout", {
  payload: { orderId: Schema.String, cents: Schema.Int },
  success: Schema.Int,
  error: PaymentDeclined,
  idempotencyKey: ({ orderId }) => orderId,
});

const checkoutLayer = Checkout.toLayer(
  Effect.fn("Checkout.run")(function* ({ orderId, cents }) {
    return yield* Activity.make({
      name: "ChargeCard",
      success: Schema.Int,
      error: PaymentDeclined,
      execute: Effect.gen(function* () {
        if (cents > 10_000) return yield* new PaymentDeclined({ orderId });
        return yield* Clock.currentTimeMillis;
      }),
    });
  }),
);

layer(checkoutLayer.pipe(Layer.provideMerge(WorkflowEngine.layerMemory)))("Checkout", (it) => {
  it.effect("runs once per idempotency key and keeps typed failures", () =>
    Effect.gen(function* () {
      const chargedAt = yield* Checkout.execute({ orderId: "o-1", cents: 500 });
      yield* TestClock.adjust("1 hour");
      assert.strictEqual(yield* Checkout.execute({ orderId: "o-1", cents: 500 }), chargedAt);
      const declined = yield* Checkout.execute({ orderId: "o-2", cents: 50_000 }).pipe(Effect.flip);
      assert.strictEqual(declined._tag, "PaymentDeclined");
    }),
  );
});
```

**Gotchas**

- `idempotencyKey` maps a payload to one execution. A second `execute` returns the first result.
- `WorkflowEngine.layerMemory` forgets every run on restart. Production uses `ClusterWorkflowEngine.layer` over `SingleRunner.layer()` and a `SqlClient`.
- The body re-runs on every resume. Put clock reads, randomness, and I/O inside an `Activity`.
- An activity's name is its replay key. Keep names unique and stable inside one workflow.
- `Workflow.withCompensation` undoes a step when the whole workflow later fails. It works on top-level steps only.

**Read:** `node_modules/effect/src/workflow/Workflow.ts`, `Activity.ts`, `DurableDeferred.ts`.

## Cluster

**What:** many copies of a service on many machines. Each entity id has one live instance, handling one message at a time.
**Use** when per-account or per-room state must never run on two machines at once. **Not** inside one process — use a `Semaphore`. **Not** for stateless HTTP — scale the server.
**Why:** shards move when a machine dies, so each id keeps exactly one owner.
Extras: `Singleton.make(name, effect)` runs one loop cluster-wide. `ClusterCron.make({ name, cron, execute })` takes a parsed `Cron` and fires once per cluster.
Key APIs: `Entity.make(type, [rpcs])`, `entity.toLayer(handlers, { maxIdleTime })`, `entity.client`, `ClusterSchema.Persisted`, `TestRunner.layer`, `SingleRunner.layer`.
**Gotcha:** `TestRunner.layer` stalls under `TestClock`. Use `layer(..., { excludeTestServices: true })` from `@effect/vitest`.
**Read:** `node_modules/effect/ai-docs/src/80_cluster/10_entities.ts`.

## Persistence

**What:** small durable building blocks with swappable stores: memory, file system, SQL, Redis.

- `KeyValueStore`: string keys and values. `KeyValueStore.toSchemaStore(kv, schema)` adds typed JSON.
- `PersistedCache.make(lookup, { storeId, timeToLive })`: cache entries survive restarts. Keys are `Persistable.Class` requests.
- `PersistedQueue.make({ name, schema })`: an at-least-once job queue. `queue.offer(value)` and `queue.take(handler)`.
- `RateLimiter`: `consume({ key, limit, window, onExceeded })` enforces one limit across processes.

**Use** when state must outlive the process. **Not** in-process — use `Cache` ([caching](caching.md)) or `Queue` ([concurrency](concurrency.md)). **Not** for relational data — use [sql](sql.md).
**Why:** the store is a layer. Tests run on the memory store, production on SQL or Redis.
**Gotchas**

- `kv.get` returns `string | undefined`. The schema store's `get` returns an `Option`.
- A crash after the handler and before the ack redelivers the job. Make `take` handlers idempotent.
- `PersistedCache` stores failures too. `timeToLive(exit, key)` picks a lifetime per outcome.

**Read:** `node_modules/effect/src/persistence/`, one module header per building block.

## Reactivity and Atom

**What:** `Reactivity` is an in-process invalidation bus. A write tagged with keys re-runs every read tagged with them.
`Atom` is reactive UI state. Its value is a plain value, a derived value, an Effect, or a Stream.
**Use** `Reactivity` for a live view that refreshes after writes in the same process. `SqlClient.reactive` builds on it. **Not** across processes — use pub/sub or `effect/eventlog`.
**Use** `Atom` with `@effect/atom-react`, `-solid`, or `-vue` when the UI runs Effect. **Not** when the client does not run Effect — render server data.
**Why:** keys link writes to reads. Effect atoms render as `AsyncResult`, with no `useEffect`.
Key APIs: `Reactivity.mutation(effect, keys)`, `Reactivity.stream(effect, keys)`, `Reactivity.invalidate(keys)`, `Atom.make`, `Atom.family`, `Atom.fn`, `AtomRegistry.make`, `AsyncResult.match`.
React hooks: `useAtomValue`, `useAtomSet`, `useAtomRefresh`, and `RegistryProvider` at the root.
**Gotchas:** module functions take `(effect, keys)`, service methods `(keys, effect)`. A failed mutation invalidates nothing.
**Read:** `node_modules/effect/src/reactivity/Reactivity.ts`, `Atom.ts`.

## EventLog

**What:** event sourcing for local-first apps. A write runs its handler, then commits to a journal. `EventLogRemote.layerEncrypted` syncs journals end-to-end encrypted.
**Use** for an offline-capable app that syncs across tabs and devices. **Not** for server CRUD — use SQL. **Not** for jobs — use `PersistedQueue`.
**Why:** the handler runs before the commit, so local state never lags the journal.
Key APIs: `EventGroup.empty.add({ tag, primaryKey, payload })`, `EventLog.schema(group)`, `EventLog.group(group, handlers)`, `EventLog.layer`, `EventLog.makeClient`, `EventJournal.layerIndexedDb`.
**Read:** `node_modules/effect/src/eventlog/EventLog.ts`.

## Model

**What:** one field list that derives `select`, `insert`, `update`, `json`, `jsonCreate`, and `jsonUpdate` schemas.
**Use** for a table row with generated ids, timestamps, or private columns. **Not** for a plain DTO — use `Schema.Class` ([schema](schema.md)).
**Why:** one declaration keeps the row, insert, and API shapes from drifting.
Key APIs: `Model.Class`, `Model.GeneratedByDb`, `Model.GeneratedByApp`, `Model.Sensitive`, `Model.DateTimeInsert`, `Model.DateTimeUpdate`, `Model.FieldOption`. `SqlModel.makeRepository(Item, { tableName, spanPrefix, idColumn })` derives CRUD.
**Read:** `node_modules/effect/ai-docs/src/40_sql/10_basics.ts`.

## Small subpaths

| Module                 | Solves                                          | Use when                                                          | Not when                              |
| ---------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| `effect/observability` | OTLP export of traces, logs, metrics            | Shipping telemetry. Read [observability](observability.md)        | Local debugging: `effect/devtools`    |
| `effect/socket`        | TCP and WebSocket connections with backpressure | A custom wire protocol                                            | Typed messages: RPC over WebSocket    |
| `effect/workers`       | Web Worker and `worker_threads` plumbing        | CPU work off the main thread, via `RpcClient.layerProtocolWorker` | Hand-rolled messages: RPC frames them |
| `effect/devtools`      | Spans mirrored to the Effect devtools           | Local tracing: `DevTools.layer()`                                 | Production: OTLP                      |
| `effect/net`           | IP, MAC, and CIDR values                        | `IpNetwork.fromString`, `IpNetwork.contains`                      | Hostnames and URLs: `URL`             |

## Core niche modules

Import these from `"effect"`. Each export carries **When to use** JSDoc.

**`Graph`** holds nodes and edges with traversal and path-finding. Build with `Graph.directed((g) => ...)`, `Graph.addNode`, `Graph.addEdge`.
Use `Graph.topo` for dependency order and `Graph.dijkstra` for shortest paths. `topo` throws a `GraphError` on a cycle: check `Graph.isAcyclic`.

**`TxRef`** and `TxQueue`, `TxHashMap`, `TxSemaphore` replace STM. Ops inside `Effect.tx(...)` commit together or not at all.
Use them when two or more values must change atomically. One value is a `Ref`.

**`LayerMap`** builds and caches one layer per key, released after `idleTimeToLive`.
Declare `class TenantClients extends LayerMap.Service<TenantClients>()(id, { lookup, idleTimeToLive }) {}`.
Provide `TenantClients.layer` once, then `Effect.provide(TenantClients.get(tenantId))` per call. One fixed dependency is a plain layer.

**`Pool`** keeps N scoped resources. `Pool.make({ acquire, size })`, then `Pool.get(pool)` inside a scope. One shared client is a layer.

**`RcMap`** acquires a resource per key on first use and releases it after the last user plus `idleTimeToLive`. `RcMap.make({ lookup, idleTimeToLive })`, then `RcMap.get(map, key)`.

**`Cron`** parses and evaluates cron expressions. `Cron.parse(expr)` returns a `Result`. `Schedule.cron(expr)` drives `Effect.repeat`.

**Smaller core modules.** Reach for these only when the plain alternative breaks:

| Module          | Use when                                             | Plain alternative         |
| --------------- | ---------------------------------------------------- | ------------------------- |
| `BigDecimal`    | money or rates where `number` rounding is wrong      | `number` in integer cents |
| `Optic`         | updating a deep path in immutable data               | object spread             |
| `MutableRef`    | synchronous mutable state outside effects            | `let`                     |
| `ScopedRef`     | swapping a value whose old version must be released  | `Ref`                     |
| `Resource`      | a scoped value refreshed on a schedule, like a token | `Effect.cachedWithTTL`    |
| `Trie`          | prefix lookup over string keys                       | `Map`                     |
| `HashRing`      | assigning keys to nodes with consistent hashing      | modulo                    |
| `ErrorReporter` | sending failures to an external tracker              | `Effect.logError`         |

**`ExecutionPlan`** tries steps in order, each providing different layers. `ExecutionPlan.make({ provide: primaryLayer, attempts: 2 }, { provide: fallbackLayer })` with `Effect.withExecutionPlan(plan)`.
Use it for provider fallback with per-step attempts. One fallback call is `Effect.catch`.

## Fail review on

```ts
const workflowsLayer = checkoutLayer.pipe(Layer.provide(WorkflowEngine.layerMemory));
NodeRuntime.runMain(Layer.launch(Layer.mergeAll(serverLayer, workflowsLayer)));
```

`layerMemory` loses every run on restart. Use `ClusterWorkflowEngine.layer` over `SingleRunner.layer()` and a `SqlClient` layer.

```ts
Checkout.toLayer(
  Effect.fn("Checkout.run")(function* (payload) {
    const receiptId = yield* crypto.randomUUIDv4;
    yield* Activity.make({ name: "ChargeCard", execute: charge(payload, receiptId) });
  }),
);
```

The body re-runs on resume, so the id changes. Generate it inside the activity.

## Upstream

`node_modules/effect/ai-docs/src/01_effect/05_resources/30_layer-map.ts`, `node_modules/effect/ai-docs/src/71_ai/10_language-model.ts`, and the **Read** paths above.
