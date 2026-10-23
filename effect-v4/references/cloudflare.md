# Cloudflare Workers

Effect 4.0.0 at the Worker edge: setup, lifetime, env, bindings, D1, queues, logs, Durable Objects, verification.

## Setup

**Use** `effect`, plus `@effect/sql-d1` or `@effect/sql-sqlite-do`. **Not** `@effect/platform-cloudflare` — it does not exist.
**Why:** Effect imports no `node:` module outside `effect/testing`. Workers need no platform package.

- `wrangler.jsonc`: `main`, a current `compatibility_date`, bindings, `vars`, `secrets.required`, `observability.logs` and `.traces` on.
- Add no `compatibility_flags`. Dates from `2026-08-04` enable `nodejs_compat` by default.
- `wrangler types` writes `Env` to `worker-configuration.d.ts`. Include it with `lib: ["es2024"]`, no DOM. CI runs `wrangler types --check`.

## Per-invocation graph

**Use** `Effect.runPromise(Effect.provide(program, appLayer(inputs)))` in every handler. **Not** a module-level `ManagedRuntime`, the [services](services.md) default.
**Why:** `ManagedRuntime` forks its layer build inside the first request. Workers bind promises to their request. Concurrent requests awaiting that build are cancelled as hung: 4 of 5 in a measured run.

- Cost: about 40 µs for a six-layer graph. `Effect.provide` runs layer finalizers before the promise settles.
- Return that promise from `fetch`, `scheduled`, and `queue`. The runtime awaits all three. `scheduled` needs no `ctx.waitUntil`; a rejection marks the cron run failed.

## Env and bindings

**Use** one `run(env, program)` that copies `env` into typed inputs. **Not** `Config` or any `layerConfig` for Worker settings.
**Why:** the default `ConfigProvider` reads `process.env`. Workers populate it, secrets included. A `layerConfig` reads it silently.

- Layer constructors take plain values: bindings, strings, `Redacted`.
- Wrap R2, KV, and Queue with `Layer.succeed`, like `ItemQueue`. A service that yields another service uses `Layer.effect`.
- Decode string vars once, in `run`. `Env` below stands in for `wrangler types` output.

```ts
import * as D1Client from "@effect/sql-d1/D1Client";
import { Context, Effect, Layer, Logger, LogLevel, References, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

interface Env {
  readonly DB: D1Database;
  readonly ITEMS: Queue;
  readonly LOG_LEVEL: string;
}
const queueRetryDelaySeconds = 30;
class BadBody extends Schema.TaggedError<BadBody>()("BadBody", { cause: Schema.Defect() }) {}
class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}
const Item = Schema.Struct({ id: Schema.String, name: Schema.String });
type Item = typeof Item.Type;

class ItemStore extends Context.Service<
  ItemStore,
  { readonly save: (item: Item) => Effect.Effect<void, StoreError> }
>()("@app/store/ItemStore") {}
const itemStoreLayer = Layer.effect(
  ItemStore,
  Effect.gen(function* () {
    const sql = yield* D1Client.D1Client;
    return ItemStore.of({
      save: Effect.fn("ItemStore.save")((item: Item) =>
        sql
          .batch([
            sql`INSERT INTO items ${sql.insert(item)} ON CONFLICT DO NOTHING`,
            sql`INSERT INTO item_events ${sql.insert({ item_id: item.id, kind: "saved" })} ON CONFLICT DO NOTHING`,
          ])
          .pipe(Effect.mapError((cause) => new StoreError({ operation: "save", cause }))),
      ),
    });
  }),
);
class ItemQueue extends Context.Service<
  ItemQueue,
  { readonly send: (item: Item) => Effect.Effect<void, StoreError> }
>()("@app/queue/ItemQueue") {}
const itemQueueLayer = (queue: Queue<typeof Item.Encoded>) =>
  Layer.succeed(
    ItemQueue,
    ItemQueue.of({
      send: Effect.fn("ItemQueue.send")((item: Item) =>
        Effect.tryPromise({
          try: () => queue.send(item),
          catch: (cause) => new StoreError({ operation: "enqueue", cause }),
        }),
      ),
    }),
  );
const appLayer = (input: {
  db: D1Database;
  items: Queue<typeof Item.Encoded>;
  logLevel: LogLevel.LogLevel;
}) =>
  Layer.mergeAll(
    itemStoreLayer.pipe(Layer.provide(D1Client.layer({ db: input.db }))),
    itemQueueLayer(input.items),
    Logger.layer([Logger.consoleStructured]),
    Layer.succeed(References.MinimumLogLevel, input.logLevel),
  ).pipe(Layer.provide(FetchHttpClient.layer));
const decodeLogLevel = Schema.decodeUnknownSync(Schema.Literals(LogLevel.values));
const run = <A, E>(env: Env, program: Effect.Effect<A, E, ItemStore | ItemQueue>) =>
  Effect.runPromise(
    Effect.provide(
      program,
      appLayer({ db: env.DB, items: env.ITEMS, logLevel: decodeLogLevel(env.LOG_LEVEL) }),
    ),
  );

const handleRequest = Effect.fn("Worker.handleRequest")(
  function* (request: Request) {
    const item = yield* Schema.decodeEffect(Schema.fromJsonString(Item))(
      yield* Effect.tryPromise({
        try: () => request.text(),
        catch: (cause) => new BadBody({ cause }),
      }),
    );
    yield* ItemQueue.use((queue) => queue.send(item));
    return Response.json({ id: item.id }, { status: 202 });
  },
  Effect.catchTags({
    SchemaError: () => Effect.succeed(new Response(null, { status: 400 })),
    BadBody: () => Effect.succeed(new Response(null, { status: 400 })),
    StoreError: (error) =>
      Effect.annotateLogs(Effect.logError("enqueue failed"), { operation: error.operation }).pipe(
        Effect.as(new Response(null, { status: 503 })),
      ),
  }),
);
const handleMessage = Effect.fn("Worker.handleMessage")(
  function* (message: Message<unknown>) {
    const item = yield* Schema.decodeUnknownEffect(Item)(message.body);
    yield* ItemStore.use((store) => store.save(item));
    yield* Effect.sync(() => message.ack());
  },
  (effect, message) =>
    effect.pipe(
      Effect.tapError((error) =>
        Effect.annotateLogs(Effect.logWarning("message retried"), { tag: error._tag }),
      ),
      Effect.catchTags({
        SchemaError: () => Effect.sync(() => message.retry()),
        StoreError: () =>
          Effect.sync(() => message.retry({ delaySeconds: queueRetryDelaySeconds })),
      }),
      Effect.annotateLogs({ messageId: message.id, attempts: message.attempts }),
    ),
);
export default {
  fetch: (request, env) => run(env, handleRequest(request)),
  scheduled: (controller, env) =>
    run(env, Effect.annotateLogs(Effect.logInfo("tick"), { cron: controller.cron })),
  queue: (batch, env) => run(env, Effect.forEach(batch.messages, handleMessage, { discard: true })),
} satisfies ExportedHandler<Env>;
```

## D1

**Use** `D1Client.layer({ db })`. It provides `D1Client` and `SqlClient`. **Not** `sql.withTransaction` — it dies on D1.
**Why:** D1 has no interactive transactions. `sql.batch([...])` on `D1Client` is one round trip, rolled back whole on any failure.

- A statement binds at most 100 parameters. Chunk multi-row `sql.insert` to stay under it.
- `batch` takes raw `sql` statements, not `SqlSchema` functions. Other queries work as in [sql](sql.md).
- `sql.stream` dies. `D1Client.layer` declares a `ConfigError` that never occurs. Each invocation starts a fresh statement cache.

## Queue consumers

**Use** one edge function per message that decodes, works, and settles. **Not** a handler that lets errors escape.
**Why:** a rejected `queue()` promise retries every un-acked message. Each message needs one `ack()` or `retry()`, chosen by error tag.

- Domain code never sees `Message`. Only the edge function settles.
- `message.body` is `unknown` JSON, 128 KB max. Decode it with Schema. Send the encoded form; `Date` does not survive.
- An undecodable body never recovers. `retry()` moves it to `dead_letter_queue` after `max_retries`. Without a DLQ, log and `ack()`.
- Delivery is at least once. A retry keeps `message.id`; a producer re-send gets a new one. Key writes on domain data: `ON CONFLICT DO NOTHING`.
- Settlement is not provider retry. `Effect.retry` covers seconds inside one invocation. `message.retry({ delaySeconds })` covers minutes. Pick one owner per failure; see [time](time.md).

## Logs and traces

**Use** `Logger.layer([Logger.consoleStructured])` and `References.MinimumLogLevel` from a decoded var. **Not** `Logger.consoleJson` or `Logger.consoleLogFmt` — each logs a string.
**Why:** `consoleStructured` logs an object. Workers Logs indexes the fields of a logged object.

- Put queryable values in `Effect.annotateLogs`. They land in `annotations`. Extra `log*` arguments stay in the `message` array.
- `consoleStructured` always calls `console.log`. Filter on the `level` field.
- Workers traces cover fetch, bindings, and handlers. Effect spans are not exported there. Omit `Logger.tracerLogger`.

## Durable Objects

**Use** `SqliteClient.layer({ storage: this.ctx.storage })` from `@effect/sql-sqlite-do`. **Not** `{ db: ctx.storage.sql }` — `withTransaction` then fails.
**Why:** only `storage` enables `storage.transaction`. `withTransaction` and the migrator both need it.

- Migrate under `ctx.blockConcurrencyWhile`. Build the layer per call. Sibling transactions cannot run concurrently.

```ts
import * as SqliteClient from "@effect/sql-sqlite-do/SqliteClient";
import * as SqliteMigrator from "@effect/sql-sqlite-do/SqliteMigrator";
import { DurableObject } from "cloudflare:workers";
import { Effect } from "effect";
import { SqlClient, SqlError } from "effect/sql";

const migrations = SqliteMigrator.fromRecord({
  "1_hits": SqlClient.SqlClient.use((sql) => sql`CREATE TABLE hits (id INTEGER PRIMARY KEY)`),
});
const recordHit: Effect.Effect<void, SqlError.SqlError, SqlClient.SqlClient> =
  SqlClient.SqlClient.use((sql) => sql`INSERT INTO hits DEFAULT VALUES`);
export class Counter extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => this.run(SqliteMigrator.run({ loader: migrations })));
  }
  record(): Promise<void> {
    return this.run(recordHit);
  }
  private run<A, E>(program: Effect.Effect<A, E, SqlClient.SqlClient>): Promise<A> {
    return Effect.runPromise(
      Effect.provide(program, SqliteClient.layer({ storage: this.ctx.storage })),
    );
  }
}
```

## Verify

**Use** `wrangler dev` with real local bindings. **Not** mocked bindings or Worker loopback (`SELF.fetch`).
**Why:** local D1, R2, KV, Queues, and Durable Objects run in workerd, the production runtime.

- Service logic: `@effect/vitest` over bindings from wrangler's `getPlatformProxy({ persist: false })`. Build it in `Layer.unwrap(Effect.acquireRelease(...))` so `proxy.dispose()` runs. See [testing](testing.md).
- Host glue gets no unit tests. Run `wrangler dev`, call it, and read state with `wrangler d1 execute <db> --local`.

## Gotchas

- `Date.now()` and `Clock` advance only across I/O. Log-span durations measure I/O wait, not CPU.
- No I/O at global scope. `env` from `cloudflare:workers` is readable there; binding calls throw.
- A failure reaching `runPromise` logs as `Uncaught <Tag>`. Give edge-reachable errors a `message` field.
- `wrangler types` types `vars` as literals. Decode those with `Schema.decodeSync`, not `decodeUnknownSync`.
- Destructured `ctx.waitUntil` throws "Illegal invocation". Call `ctx.waitUntil(...)`. It gets 30 s after the response.
- Local crons never fire. Trigger one: `curl "localhost:8787/cdn-cgi/local/scheduled?cron=<expr>&format=json"`.
- With `secrets.required` set, only the listed keys load from `.dev.vars`.

## Fail review on

```ts
const runtime = ManagedRuntime.make(appLayer);
export default { fetch: (request) => runtime.runPromise(handleRequest(request)) };
```

Build the graph per invocation: `Effect.runPromise(Effect.provide(program, appLayer(inputs)))`.

```ts
OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") });
```

Read the key in `run`: `OpenAiClient.layer({ apiKey: Redacted.make(env.OPENAI_API_KEY) })`.

## Upstream

`node_modules/@effect/sql-d1/src/D1Client.ts`, `node_modules/@effect/sql-sqlite-do/src/SqliteClient.ts`, `node_modules/effect/src/ManagedRuntime.ts`
