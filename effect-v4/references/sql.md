# SQL

Statements with `SqlClient`, rows decoded by `SqlSchema`, tests on real SQLite.

## Queries

**Use** `SqlClient` from `effect/sql` for every statement. **Not** the driver's own API.
**Why:** one client gives bound parameters, spans, transactions, and a typed `SqlError`.

`` sql`SELECT * FROM items WHERE item_id = ${itemId}` `` binds `itemId` as a parameter. It never concatenates.
A template is `Effect<ReadonlyArray<Row>, SqlError>`. Each `Row` is `{ readonly [column: string]: unknown }`. Zero rows is success with `[]`.
Do not write `sql<ItemRow>`. It type-checks, and it is a lie. Decode with `SqlSchema`.
Fragments: `sql.insert(row)`, `sql.update(row)`, `sql.in(ids)`, `sql.and(clauses)`. `sql("name")` is an escaped identifier.
`sql.unsafe(text)` and `sql.literal(text)` splice raw SQL. Never pass input to them.

## SqlSchema

**Use** `SqlSchema` for every query whose rows you read. **Not** a cast on the rows.
**Why:** it encodes the request, runs `execute`, and decodes the rows in one call.
Each helper takes `{ Request, Result, execute }`. `SqlSchema.void` has no `Result`. `execute` receives the encoded request.

| Result       | Helper                                        | On zero rows                      |
| ------------ | --------------------------------------------- | --------------------------------- |
| Many rows    | `SqlSchema.findAll`                           | `[]`                              |
| Optional row | `SqlSchema.findOneOption`                     | `Option.none()`                   |
| Required row | `SqlSchema.findOne`, `SqlSchema.findNonEmpty` | `Cause.NoSuchElementError` in `E` |
| Write only   | `SqlSchema.void`                              | no row decode                     |

`findOne` and `findOneOption` decode the first row and drop the rest. Query by a unique key.

## Store

**Use** one store service. Build each query once in `Layer.effect`. Wrap each method in `Effect.fn("ItemStore.method")` with one `mapError` to `StoreError`.
**Not** `SqlSchema.findAll({ ... })` inside a method. It rebuilds the codecs per call.
**Why:** one span and one error mapping per method. Methods have `R = never`.

The store and its test, against real SQLite with the production migrations:

```ts
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { assert, describe, it } from "@effect/vitest";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

const Item = Schema.Struct({
  item_id: Schema.String,
  quantity: Schema.Int,
  tags: Schema.fromJsonString(Schema.Array(Schema.String)),
});
type Item = typeof Item.Type;

class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

class ItemStore extends Context.Service<
  ItemStore,
  {
    find(itemId: string): Effect.Effect<Option.Option<Item>, StoreError>;
    readonly list: Effect.Effect<ReadonlyArray<Item>, StoreError>;
    put(item: Item): Effect.Effect<void, StoreError>;
  }
>()("@app/store/ItemStore") {}

const storeError = (operation: string) =>
  Effect.mapError((cause: unknown) => new StoreError({ operation, cause }));

export const itemStoreLayer = Layer.effect(
  ItemStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const findQuery = SqlSchema.findOneOption({
      Request: Schema.String,
      Result: Item,
      execute: (itemId) => sql`SELECT * FROM items WHERE item_id = ${itemId}`,
    });
    const listQuery = SqlSchema.findAll({
      Request: Schema.Void,
      Result: Item,
      execute: () => sql`SELECT * FROM items ORDER BY item_id`,
    });
    const putQuery = SqlSchema.void({
      Request: Item,
      execute: (row) => sql`INSERT INTO items ${sql.insert(row)}
      ON CONFLICT (item_id) DO UPDATE SET quantity = excluded.quantity, tags = excluded.tags`,
    });
    return ItemStore.of({
      find: Effect.fn("ItemStore.find")(findQuery, storeError("find")),
      list: listQuery().pipe(storeError("list"), Effect.withSpan("ItemStore.list")),
      put: Effect.fn("ItemStore.put")(putQuery, storeError("put")),
    });
  }),
);

const migrations = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord({
    "0001_create_items": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TABLE items (item_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL, tags TEXT NOT NULL)`;
    }),
  }),
});
const sqlite = SqliteClient.layer({ filename: ":memory:" });
const testStore = itemStoreLayer.pipe(Layer.provideMerge(migrations), Layer.provideMerge(sqlite));

describe("ItemStore on real SQLite", () => {
  it.effect("upserts one identity and finds none for a missing row", () =>
    Effect.gen(function* () {
      const store = yield* ItemStore;
      yield* store.put({ item_id: "a", quantity: 1, tags: [] });
      yield* store.put({ item_id: "a", quantity: 2, tags: ["x"] });
      assert.deepStrictEqual(yield* store.list, [{ item_id: "a", quantity: 2, tags: ["x"] }]);
      assert.isTrue(Option.isNone(yield* store.find("missing")));
    }).pipe(Effect.provide(testStore)),
  );

  it.effect("reports a corrupt JSON column as StoreError", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`INSERT INTO items VALUES ('b', 1, 'not json')`;
      const error = yield* Effect.flip((yield* ItemStore).find("b"));
      assert.deepStrictEqual([error._tag, error.operation], ["StoreError", "find"]);
    }).pipe(Effect.provide(testStore)),
  );
});
```

**Gotchas**

- A no-arg query is one Effect value. `list` is `listQuery()` piped once, not a function.
- A JSON column is a second decode hop. Put `Schema.fromJsonString(S)` on the field. `execute` then writes JSON text.
- Return `Option`. Use `Effect.map(Option.getOrNull)` only when the contract says `null`.
- "Not found" belongs to the caller. A `requireItem` turns `Option.none()` into `ItemMissing`.
- `Effect.provide(testStore)` per test gives each test a fresh database.
- SQLite tests do not prove Postgres locking, isolation, or dialect.

## Writes

**Use** an upsert (`ON CONFLICT ... DO UPDATE`) for any write a retry can repeat. **Not** read-then-insert.
**Why:** a replayed upsert writes the same row. Read-then-insert races.
An upsert does not make `quantity = quantity + 1`, emails, or charges idempotent.
**Constraints.** Catch the reason first: `Effect.catchReason("SqlError", "UniqueViolation", () => Effect.fail(new NameTaken({ name })))`.
Then map only infrastructure errors: `Effect.catchTag(["SqlError", "SchemaError"], (cause) => Effect.fail(new StoreError({ operation: "create", cause })))`.
A blanket `mapError` after `catchReason` wraps `NameTaken` in `StoreError` too.
SQLite reports a primary-key conflict as `ConstraintError`. Only a `UNIQUE` column gives `UniqueViolation`.

## Transactions

**Use** `sql.withTransaction(effect)` when several statements commit together. **Not** around provider calls.
**Why:** the transaction holds a connection and its locks while you wait.
A failure, defect, or interruption rolls back. A nested `withTransaction` becomes a savepoint.
Side effects go in an outbox row inside the transaction. Send them after commit.
A multi-statement write is not one `SqlSchema` call. Wrap the transaction in one `mapError`.

## Migrations

**Use** the driver's migrator: `SqliteMigrator.layer({ loader: SqliteMigrator.fromRecord({ "0001_create_items": effect }) })`. **Not** a test-only `CREATE TABLE`.
**Why:** tests then run the production schema. A copied `CREATE TABLE` drifts.
It runs pending migrations when the layer builds. Every driver below ships one: `PgMigrator`, `MysqlMigrator`, `LibsqlMigrator`, ...
`Migrator.fromFileSystem(dir)` imports `<id>_<name>.ts` files that default-export the effect. It needs `FileSystem` and `Path`.

## Drivers

| Database                             | Package                                                                                | Layer                              |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------- |
| SQLite on Node (`node:sqlite`)       | `@effect/sql-sqlite-node`                                                              | `SqliteClient.layer({ filename })` |
| Postgres                             | `@effect/sql-pg`                                                                       | `PgClient.layer({ url })`          |
| MySQL                                | `@effect/sql-mysql2`                                                                   | `MysqlClient.layer({ url })`       |
| libSQL, Turso                        | `@effect/sql-libsql`                                                                   | `LibsqlClient.layer({ url })`      |
| SQL Server, ClickHouse, PGlite       | `@effect/sql-mssql`, `@effect/sql-clickhouse`, `@effect/sql-pglite`                    | `*Client.layer`                    |
| SQLite on Bun, browser, React Native | `@effect/sql-sqlite-bun`, `@effect/sql-sqlite-wasm`, `@effect/sql-sqlite-react-native` | `SqliteClient.layer`               |

Every driver layer provides `SqlClient`, so stores do not change. Provide the driver once, at the composition root.
For D1 or Durable Object SQLite, read [cloudflare](cloudflare.md).

## Beyond queries

`SqlResolver.findById` batches concurrent lookups into one query. Read [caching](caching.md).
`Model.Class` from `effect/schema` derives insert, update, and JSON variants from one field list.

## Fail review on

<!-- prettier-ignore -->
```ts
const rows = yield* sql<{ readonly item_id: string }>`SELECT item_id FROM items`
```

Decode with `SqlSchema.findAll({ Request, Result: Item, execute })`.

<!-- prettier-ignore -->
```ts
yield* sql.withTransaction(Effect.gen(function* () {
  yield* orders.insert(order)
  yield* payments.charge(order)
}))
```

Charge outside the transaction. Write an outbox row inside it.

## Upstream

`node_modules/effect/ai-docs/src/40_sql/10_basics.ts`
