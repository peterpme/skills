# Schema

Boundary and domain types: define, decode, construct, transform, export.

## Pick

| I have                                           | Use                                                           |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `unknown` input: a request body, a queue message | `Schema.decodeUnknownEffect(S)`                               |
| JSON text                                        | `Schema.decodeEffect(Schema.fromJsonString(S))`               |
| A value already typed as `S.Encoded`             | `Schema.decodeEffect(S)`                                      |
| A value I built: a constant, a fixture, a result | `S.make(input)` or `satisfies typeof S.Type`                  |
| A domain value to send                           | `Schema.encodeEffect(S)`                                      |
| A wire format no built-in covers                 | `Schema.decodeTo` + `SchemaTransformation.transform`          |
| A JSON Schema or Standard Schema consumer        | `Schema.toJsonSchemaDocument(S)`, `Schema.toStandardSchemaV1` |

## Define

**Use** `Schema.Struct` for a record that crosses a boundary or names a domain value. **Not** for a value one function sees — use a TS type.
**Why:** one value is the validator, the codec, and the type.

```ts
import { Schema } from "effect";

export const ItemId = Schema.NonEmptyString.pipe(Schema.brand("ItemId"));
export type ItemId = typeof ItemId.Type;
export const Item = Schema.Struct({
  id: ItemId,
  sku: Schema.String.check(Schema.isPattern(/^[A-Z]{3}-\d{4}$/)),
  quantity: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 1000 })),
  status: Schema.Literals(["active", "archived"]),
  note: Schema.optionalKey(Schema.String),
});
export type Item = typeof Item.Type;
export type ItemEncoded = typeof Item.Encoded;
```

| Meaning                                              | Schema                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Text, required text, flag, whole number, real number | `Schema.String`, `Schema.NonEmptyString`, `Schema.Boolean`, `Schema.Int`, `Schema.Finite`                      |
| Fixed set of strings                                 | `Schema.Literals(["a", "b"])`                                                                                  |
| Range, pattern, length                               | `Schema.isBetween({ minimum, maximum })`, `Schema.isPattern(re)`, `Schema.isMinLength(n)` inside `.check(...)` |
| Custom rule                                          | `.check(Schema.makeFilter((value) => ok \|\| "message"))`                                                      |

- **Brand** ids with `Schema.brand("ItemId")`. A plain `string` no longer type-checks as an `ItemId`.
- `Schema.Number` accepts `NaN` and `Infinity`. The language service flags it. Use `Schema.Finite` or `Schema.Int`.
- `Schema.Literal` takes one value. `Literals`, `Union`, and `Tuple` take arrays.
- **Classes**: `Schema.Class<Product>("Product")({ ... })` only when a validated value needs methods. Otherwise `Struct`: a class value needs `new`. `new Product(input)` validates and throws.

## Optional fields

| The wire says                                    | Schema                       | Type                 |
| ------------------------------------------------ | ---------------------------- | -------------------- |
| key can be missing                               | `Schema.optionalKey(S)`      | `a?: T`              |
| key missing or `undefined`                       | `Schema.optional(S)`         | `a?: T \| undefined` |
| `null` is a real value (SQL `NULL`, JSON `null`) | `Schema.NullOr(S)`           | `a: T \| null`       |
| `null` means none, domain wants `Option`         | `Schema.OptionFromNullOr(S)` | `a: Option<T>`       |

- SQL drivers return `null`, never a missing key. `optionalKey` rejects a `NULL` column.

## Variants

**Use** `Schema.TaggedUnion` for a wire value with several shapes. **Not** for plain string choices — use `Schema.Literals`.
**Why:** `_tag` is set for you, and you get `cases`, `guards`, and an exhaustive `match`.

```ts
import { Schema } from "effect";

export const ItemEvent = Schema.TaggedUnion({
  Created: { id: Schema.String, name: Schema.NonEmptyString },
  Archived: { id: Schema.String, reason: Schema.NullOr(Schema.String) },
});
export const describeEvent = ItemEvent.match({
  Created: (event) => `created ${event.name}`,
  Archived: (event) => `archived ${event.id}`,
});
export const created = ItemEvent.cases.Created.make({ id: "item-1", name: "Lamp" });
```

One variant is `Schema.TaggedStruct("Created", { ... })`. `Schema.Union([A, B]).pipe(Schema.toTaggedUnion("_tag"))` adds the helpers to an existing union. In-process success unions use `Data.taggedEnum` ([core](core.md)).

## Decode

**Use** `Schema.decodeUnknownEffect(S)` for `unknown` input. **Not** when the input already has the `Encoded` type — use `Schema.decodeEffect(S)`.
**Why:** the language service flags the unknown decoder on typed input. The typed decoder keeps the input contract checked.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

class InvalidItem extends Schema.TaggedError<InvalidItem>()("InvalidItem", {
  message: Schema.String,
}) {}
const Item = Schema.Struct({ id: Schema.NonEmptyString, tags: Schema.Array(Schema.String) });
const ItemJson = Schema.fromJsonString(Item);
const decodeItem = Schema.decodeUnknownEffect(Item);
const readMessage = Effect.fn("ItemInbox.readMessage")(
  (message: { readonly body: unknown }) => decodeItem(message.body),
  Effect.mapError((error) => new InvalidItem({ message: error.message })),
);
it.effect("decodes once at the boundary", () =>
  Effect.gen(function* () {
    const item = yield* readMessage({ body: { id: "a", tags: ["x"], extra: 1 } });
    assert.deepStrictEqual(item, { id: "a", tags: ["x"] });
    assert.strictEqual((yield* Effect.flip(readMessage({ body: { id: "" } })))._tag, "InvalidItem");
    const fromText = yield* Schema.decodeEffect(ItemJson)('{"id":"a","tags":["x"]}');
    assert.strictEqual(yield* Schema.encodeEffect(ItemJson)(fromText), '{"id":"a","tags":["x"]}');
    const strict = Schema.decodeEffect(ItemJson, { onExcessProperty: "error" });
    assert.strictEqual(
      (yield* Effect.flip(strict('{"id":"a","tags":[],"extra":1}')))._tag,
      "SchemaError",
    );
  }),
);
```

- Build decoders once, at module level. Failure is `SchemaError`, with `.issue` and `.message`. Map it to a domain error once.
- `decodeUnknownSync` throws. Use it only at a synchronous entry, never inside an Effect.
- **JSON text** is `Schema.fromJsonString(S)`, never `JSON.parse`. Parse and shape errors both become `SchemaError`.
- **A JSON column** is a second hop: text, then shape. Type the field `Schema.fromJsonString(S)`. `Schema.String` checks only the text.
- **Excess keys** are stripped by default. Pass `{ onExcessProperty: "error" }` to reject them.

## Construct

**Use** `S.make(input)` or `satisfies` for a value you built: a constant, a fixture, a computed result. **Not** a decode.
**Why:** decoding your own output checks nothing new and hides the real boundary.

```ts
import { Schema } from "effect";

const ItemId = Schema.NonEmptyString.pipe(Schema.brand("ItemId"));
const Item = Schema.Struct({ id: ItemId, quantity: Schema.Int });
export const fixture = Item.make({ id: ItemId.make("item-1"), quantity: 2 });
export const literal = { id: ItemId.make("item-2"), quantity: 3 } satisfies typeof Item.Type;
```

| Constructor                       | On invalid input                                  |
| --------------------------------- | ------------------------------------------------- |
| `S.make(input)`                   | throws `Error`                                    |
| `S.makeOption(input)`             | `Option.none()`                                   |
| `S.makeEffect(input)`             | fails with `SchemaIssue.Issue`, not `SchemaError` |
| `{ ... } satisfies typeof S.Type` | compile error only; runs no checks                |

- A branded field takes `ItemId.make(raw)`. A plain string fails both `make` and `satisfies`.

## Transform

**Use** `Schema.decodeTo` with `SchemaTransformation.transform` when no built-in codec fits. **Not** for a solved case — use `Schema.NumberFromString`, `Schema.FiniteFromString`, `Schema.DateTimeUtcFromString`, or `Schema.OptionFromNullOr`.
**Why:** one value decodes and encodes back, so both directions stay in sync.

```ts
import { Schema, SchemaTransformation } from "effect";

export const PriceCents = Schema.String.check(Schema.isPattern(/^\d+\.\d{2}$/)).pipe(
  Schema.decodeTo(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    SchemaTransformation.transform({
      decode: (text) => Math.round(Number(text) * 100),
      encode: (cents) => (cents / 100).toFixed(2),
    }),
  ),
);
```

`From.pipe(Schema.decodeTo(To, transformation))` decodes `From.Encoded` to `To.Type`. Fallible steps use `SchemaTransformation.transformEffect` and fail with `new SchemaIssue.InvalidValue({ message })`.

## Export

**Use** `Schema.toJsonSchemaDocument(S)` for a JSON Schema document. **Use** `Schema.toStandardSchemaV1(Schema.toStandardJSONSchemaV1(Schema.toCodecJson(S)))` for a Standard Schema consumer. **Not** the Standard Schema converters on `S` itself.
**Why:** both converters mutate their argument. Their JSON Schema describes `toCodecJson(S)`, but `validate` decodes `S`, so a `Schema.Date` rejects the ISO string.

```ts
import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

const Summary = Schema.Struct({ title: Schema.NonEmptyString, createdAt: Schema.Date });
it("bridges through the JSON codec", () => {
  const bridged = Schema.toStandardSchemaV1(
    Schema.toStandardJSONSchemaV1(Schema.toCodecJson(Summary)),
  );
  const result = bridged["~standard"].validate({
    title: "Lamp",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.isTrue("value" in result && result.value.createdAt instanceof Date);
  assert.isFalse("~standard" in Summary);
  assert.strictEqual(Schema.toJsonSchemaDocument(Summary).schema.type, "object");
});
```

- `toJsonSchemaDocument(S)` already describes `toCodecJson(S)`. Decode that JSON with the codec, not with `S`.
- Reject excess keys on both sides: `toJsonSchemaDocument(S, { onExcessProperty: "error" })`, and `toStandardSchemaV1(codec, { parseOptions: { onExcessProperty: "error" } })`.
- Property tests take schemas directly. Read [testing](testing.md).

## Fail review on

<!-- prettier-ignore -->
```ts
const Created = Schema.Struct({ _tag: Schema.Literal("Created"), id: Schema.String });
const item = Schema.decodeUnknownSync(Item)(JSON.parse(text));
const built = yield* Schema.decodeUnknownEffect(Item)({ id: "item-1", quantity: 2 });
const schema = Schema.toStandardSchemaV1(Summary);
```

- `Schema.TaggedStruct("Created", { id: Schema.String })`.
- `Schema.decodeEffect(Schema.fromJsonString(Item))(text)` inside Effect code.
- `Item.make({ ... })` or `satisfies`. Decode only input you did not build.
- `Schema.toStandardSchemaV1(Schema.toStandardJSONSchemaV1(Schema.toCodecJson(Summary)))`.

## Upstream

`node_modules/effect/ai-docs/src/01_effect/02_schema/10_schema-basics.ts`, `node_modules/effect/src/Schema.ts`, `node_modules/effect/src/SchemaTransformation.ts`
