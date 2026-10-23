# Observability

Logs, spans, and metrics in code. Loggers and exporters once, at the root.

## Which one

| Need                          | Use                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A log line                    | `Effect.logInfo("message")`, `logDebug`, `logWarning`, `logError`. Fields: `Effect.annotateLogs({ field })`                        |
| A span                        | `Effect.fn("Owner.method")`. A plain effect value: `Effect.withSpan("Owner.step")`. A hot helper with no span: `Effect.fnUntraced` |
| A duration                    | `Effect.timed(effect)` → `[Duration, A]`. Not `Date.now()` math.                                                                   |
| Log format and level          | `Logger.layer([...])` of `consoleJson`, `consoleStructured`, `consolePretty()`; `References.MinimumLogLevel`                       |
| A number to chart or alert on | `Metric.counter`, `Metric.gauge`, `Metric.histogram`, `Metric.timer`                                                               |
| Export to a collector         | `Otlp.layerJson` from `effect/observability`                                                                                       |

## Logs and spans

**Use** `Effect.logInfo("message", ...values)` and its level siblings. **Not** `console.log` — it drops levels, annotations, spans, and trace context.
**Why:** every line carries the fiber's annotations, log spans, and current span. Attach log annotations and log spans as extra `Effect.fn` arguments.

```ts
import { Context, Effect, Layer, Schema } from "effect";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
class ItemRejected extends Schema.TaggedError<ItemRejected>()("ItemRejected", {
  itemId: Schema.String,
  reason: Schema.String,
}) {}
class ItemStore extends Context.Service<
  ItemStore,
  { readonly save: (item: Item) => Effect.Effect<void> }
>()("@app/store/ItemStore") {}
class Importer extends Context.Service<
  Importer,
  { readonly importItem: (itemId: string, payload: unknown) => Effect.Effect<Item, ItemRejected> }
>()("@app/import/Importer") {}

export const importerLayer = Layer.effect(
  Importer,
  Effect.gen(function* () {
    const store = yield* ItemStore;
    const importItem = Effect.fn("Importer.importItem")(
      function* (itemId: string, payload: unknown) {
        yield* Effect.annotateCurrentSpan({ itemId });
        const item = yield* Schema.decodeUnknownEffect(Item)(payload).pipe(
          Effect.tapError((error) => Effect.logWarning("item rejected", { reason: error.message })),
          Effect.mapError((error) => new ItemRejected({ itemId, reason: error.message })),
        );
        yield* store.save(item);
        yield* Effect.logInfo("item imported", { name: item.name });
        return item;
      },
      Effect.withLogSpan("import"),
      (effect, itemId) => Effect.annotateLogs(effect, { itemId }),
    );
    return Importer.of({ importItem });
  }),
);
```

**Gotchas**

- No log call takes a fields parameter. Extra arguments land in `message` as an array. Fields for every line go in `Effect.annotateLogs`.
- The default minimum level is `"Info"`. `logDebug` prints nothing until you lower it.

## Configure once

**Use** `Logger.layer([...])`, `References.MinimumLogLevel`, and the exporter in the root layer. **Not** inside services or per request.
**Why:** loggers are fiber references. One root setting reaches every fiber.

```ts
import { Layer, Logger, LogLevel, References } from "effect";
import { Otlp } from "effect/observability";

export const observabilityLayer = (input: {
  readonly minimumLogLevel: LogLevel.LogLevel;
  readonly otlpBaseUrl: string;
  readonly serviceName: string;
}) =>
  Otlp.layerJson({ baseUrl: input.otlpBaseUrl, resource: { serviceName: input.serviceName } }).pipe(
    Layer.provideMerge(Logger.layer([Logger.consoleJson, Logger.tracerLogger])),
    Layer.provideMerge(Layer.succeed(References.MinimumLogLevel, input.minimumLogLevel)),
  );
```

**Gotchas**

- `Logger.consoleJson` writes one JSON line per entry: production. `Logger.consolePretty()` is for local runs.
- `Logger.layer` replaces the defaults, `Logger.tracerLogger` included. List it to keep logs as span events. `{ mergeWithExisting: true }` adds instead.
- `LogLevel.LogLevel` is a string literal: `"Debug"`, `"Warn"`. Read it at the entry with `Config.LogLevel("LOG_LEVEL")`.

## Metrics

**Use** `Metric.counter`, `Metric.gauge`, `Metric.histogram(name, { boundaries })`, and `Metric.timer` for numbers you chart or alert on. **Not** for one-off events — log those.
**Why:** a metric aggregates in process. The exporter ships one value, not every event.
Define metrics once at module scope. `Metric.update(metric, input)`: counters add, gauges replace, histograms record. `Metric.modify` adds to a gauge.

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Metric } from "effect";

const importedItems = Metric.counter("items_imported_total", {
  description: "Items written by the importer",
});
const importDuration = Metric.timer("item_import_duration");
const apiImports = Metric.withAttributes(importedItems, { source: "api" });

const importItem = Effect.fn("Importer.importItem")(
  (itemId: string) => Metric.update(apiImports, 1).pipe(Effect.as(itemId)),
  Effect.trackDuration(importDuration),
);

it.effect("counts imports and records their duration", () =>
  Effect.gen(function* () {
    yield* importItem("i1");
    yield* importItem("i2");
    assert.strictEqual((yield* Metric.value(apiImports)).count, 2);
    assert.strictEqual((yield* Metric.value(importDuration)).count, 2);
  }).pipe(Effect.provideService(Metric.MetricRegistry, new Map())),
);
```

**Gotchas**

- `Metric.withAttributes(metric, attrs)` is a separate series. Keep attribute values low-cardinality: no ids.
- `Effect.trackErrors(counter, () => 1)` and `Effect.trackSuccesses` count outcomes without touching the body.
- The default `Metric.MetricRegistry` is shared. Give each test a fresh `new Map()`.

## Exporters

**Use** `Otlp.layerJson` from `effect/observability` to ship logs, metrics, and traces over OTLP HTTP. **Not** `@effect/opentelemetry` unless you need the OpenTelemetry JS SDK — its processors or auto-instrumentation.
**Why:** `Otlp.layerJson` needs only an `HttpClient`, so provide `FetchHttpClient.layer` once, at the root. `NodeSdk.layer` pulls in the OpenTelemetry SDK peers.
**Gotchas**

- The OTLP logger adds itself to the loggers it sees. Put `Logger.layer` under it with `Layer.provideMerge`. In `Layer.mergeAll` one logger set is silently lost.
- `Tracer` is the low-level span model exporters plug into. App code uses `Effect.fn` and `Effect.withSpan`, never `Tracer` directly.
- `OtlpTracer`, `OtlpLogger`, `OtlpMetrics` export one signal each. `PrometheusMetrics.layerHttp()` adds `/metrics` to an `HttpRouter`.

## Fail review on

```ts
Effect.catchTag("ProviderError", (error) => Effect.logError("provider failed", error));
```

The error is gone and the caller sees success. Log with `Effect.tapError`, then let it propagate or map it.

## Upstream

`node_modules/effect/ai-docs/src/08_observability/10_logging.ts`, `node_modules/effect/ai-docs/src/08_observability/20_otlp-tracing.ts`
