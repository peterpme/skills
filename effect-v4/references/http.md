# HTTP

Outbound calls with `HttpClient`. Inbound routes with `HttpRouter` and `HttpApi`.

| Need                                          | Use                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Call a third-party API                        | `HttpClient` in a [vendor client](#vendor-client)                      |
| Call an API you own                           | `HttpApiClient.make(Api, { baseUrl })` ([HttpApi](#httpapi))           |
| Health, webhooks, raw bodies, a few routes    | [`HttpRouter`](#httprouter)                                            |
| A JSON API with outside clients, OpenAPI      | [`HttpApi`](#httpapi)                                                  |
| Only your TypeScript calls it, with streaming | `effect/rpc` ([modules](modules.md))                                   |
| Test a client or a server                     | `HttpApiTest.groups`, `NodeHttpServer.layerTest` ([testing](#testing)) |

## Client

**Use** `HttpClient` from `effect/http` for every outbound call. **Not** global `fetch` inside `Effect.tryPromise`. **Not** around a vendor SDK that owns its protocol — wrap the SDK ([errors](errors.md)).
**Why:** typed errors, interruption aborts the request, one home for URL, auth, and retry, a span per call.
Provide the transport once, at the composition root: `FetchHttpClient.layer`. On Node, `NodeHttpClient.layerUndici` also works.
Services yield `HttpClient.HttpClient`. They never provide a transport.

## Vendor client

**Use** one service per vendor, built once in `Layer.effect`. **Not** a helper that every method passes the base URL to.
**Why:** `HttpClient.mapRequest` sets URL, auth, and `Accept` once. Methods have `R = never`.

```ts
import { Context, Effect, flow, Layer, Redacted, Schema } from "effect";
import {
  HttpBody,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";

class Product extends Schema.Class<Product>("Product")({
  id: Schema.String,
  name: Schema.String,
}) {}
class ProviderError extends Schema.TaggedError<ProviderError>()("ProviderError", {
  status: Schema.NullOr(Schema.Int),
  retryable: Schema.Boolean,
  cause: Schema.Defect(),
}) {}

function toProviderError(
  cause: HttpClientError.HttpClientError | HttpBody.HttpBodyError | Schema.SchemaError,
) {
  const status = cause._tag === "HttpClientError" ? (cause.response?.status ?? null) : null;
  const transport = cause._tag === "HttpClientError" && cause.reason._tag === "TransportError";
  const retryable = transport || status === 429 || (status !== null && status >= 500);
  return new ProviderError({ status, retryable, cause });
}

class Catalog extends Context.Service<
  Catalog,
  {
    product(id: string): Effect.Effect<Product, ProviderError>;
    create(name: string): Effect.Effect<Product, ProviderError>;
  }
>()("@app/provider/Catalog") {}

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
            HttpClientRequest.acceptJson,
          ),
        ),
        HttpClient.filterStatusOk,
      );
      const product = Effect.fn("Catalog.product")(
        (id: string) =>
          client
            .get(`/products/${encodeURIComponent(id)}`, { urlParams: { fields: "id,name" } })
            .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Product))),
        Effect.mapError(toProviderError),
      );
      const create = Effect.fn("Catalog.create")(
        (name: string) =>
          HttpClientRequest.post("/products").pipe(
            HttpClientRequest.bodyJson({ name }),
            Effect.flatMap(client.execute),
            Effect.flatMap(HttpClientResponse.schemaBodyJson(Product)),
          ),
        Effect.mapError(toProviderError),
      );
      return Catalog.of({ product, create });
    }),
  );
```

**Gotchas**

- `client.get(path, { urlParams })` encodes the query, not the path. Wrap path ids in `encodeURIComponent`.
- `bodyJson` fails with `HttpBodyError`. `bodyJsonUnsafe` throws instead.

## Status

**Use** `HttpClient.filterStatusOk` on the client when every non-2xx fails and all 2xx share one shape.
**Use** `HttpClientResponse.matchStatus` when 2xx bodies differ, such as a 202 job versus a 200 payload.
**Why:** the status decides which schema decodes the body.

```ts
import { Data, Effect, Schema } from "effect";
import { HttpClientResponse } from "effect/http";

class Product extends Schema.Class<Product>("Product")({
  id: Schema.String,
  name: Schema.String,
}) {}
const Job = Schema.Struct({ jobId: Schema.String });
type Submission = Data.TaggedEnum<{
  Queued: { readonly jobId: string };
  Done: { readonly product: Product };
}>;
const Submission = Data.taggedEnum<Submission>();

export const decodeSubmission = Effect.fn("Catalog.decodeSubmission")(
  (response: HttpClientResponse.HttpClientResponse) =>
    HttpClientResponse.matchStatus(response, {
      202: (queued) =>
        HttpClientResponse.schemaBodyJson(Job)(queued).pipe(Effect.map(Submission.Queued)),
      orElse: (ok) =>
        HttpClientResponse.schemaBodyJson(Product)(ok).pipe(
          Effect.map((product) => Submission.Done({ product })),
        ),
    }),
);
```

Run `decodeSubmission` after client-level `filterStatusOk`, so `orElse` sees only 2xx: `client.execute(request).pipe(Effect.flatMap(decodeSubmission))`.
A quota or payment 4xx is `E` with `retryable: false`. Never a success tag.

## Errors

`HttpClientError` covers the request and the status. Its `reason._tag` says what broke.

| `reason._tag`                    | Meaning                              | Retry?                |
| -------------------------------- | ------------------------------------ | --------------------- |
| `TransportError`                 | network, DNS, reset                  | yes                   |
| `StatusCodeError`                | `filterStatusOk` rejected the status | 429 and `>= 500` only |
| `DecodeError`, `EmptyBodyError`  | body unreadable or missing           | no                    |
| `EncodeError`, `InvalidUrlError` | request never left                   | no                    |

A wrong body shape is `Schema.SchemaError` from `schemaBodyJson`, not `HttpClientError`.
Map to the service error once, per method (`toProviderError` above). Put `status` and `retryable` on it. Never put headers or the key.

## Retry

**Use** one retry owner per failure, bounded by `times` and a schedule. **Not** stacked SDK, client, and workflow retries.
**Why:** stacked retries multiply attempts.
**Client-level.** `HttpClient.retryTransient({ schedule: Schedule.exponential("200 millis"), times: 3 })` on the vendor client.
It retries `TransportError`, `TimeoutError`, and 408, 429, 500, 502, 503, 504. It retries POSTs too, so every call must be idempotent.
**Operation-level.** Pass `Effect.retry({ while: (e) => e.retryable, times: 3, schedule: Schedule.exponential("200 millis") })` to `Effect.fn` after `mapError`. Use it when only some methods are safe to retry.
**Rate limits.** `HttpClient.withRateLimiter({ limiter, window: "1 second", limit: 10, key: "catalog", times: 3 })`.
`limiter` is `yield* RateLimiter.RateLimiter` from `effect/persistence`. Provide `RateLimiter.layer` with `RateLimiter.layerStoreMemory`.
It retries 429 itself, forever unless `times` is set. Mark 429 not `retryable` in your mapping, or attempts multiply.
**Timeouts.** A per-attempt deadline goes before `retry`. The overall budget goes after it. Read [time](time.md).

## Layers

| Layer                               | Owns                                                   | Never sees                  |
| ----------------------------------- | ------------------------------------------------------ | --------------------------- |
| Transport (`FetchHttpClient.layer`) | sockets, fetch                                         | URLs, auth                  |
| Provider (`catalogLayer`)           | base URL, auth, status, decode, `ProviderError`, retry | business rules              |
| Domain service                      | fallback between providers, deadlines, domain errors   | URLs, headers, status codes |

Retry at the provider call, not around a workflow. A workflow retry repeats sibling calls that already succeeded.

## HttpRouter

Around the router: `HttpMiddleware.cors()` adds CORS headers, and `HttpMiddleware.logger` logs each request. `HttpServerRequest.schemaBodyMultipart(S)` decodes uploads into `Multipart` parts. `HttpStaticServer.layer({ root })` serves a directory.

**Use** `HttpRouter` for a few routes, webhooks, health checks, or raw bodies. **Not** for a JSON API with outside clients — use `HttpApi`.
**Why:** no contract to maintain. Each route is a `Layer` you merge and serve.

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { createServer } from "node:http";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  cause: Schema.Defect(),
}) {}

class ItemStore extends Context.Service<
  ItemStore,
  {
    find(id: string): Effect.Effect<Option.Option<Item>, StoreError>;
  }
>()("@app/store/ItemStore") {}

const itemRoutes = HttpRouter.addAll(
  Effect.gen(function* () {
    const store = yield* ItemStore;
    return [
      HttpRouter.route(
        "GET",
        "/items/:id",
        Effect.gen(function* () {
          const { id } = yield* HttpRouter.schemaPathParams(Schema.Struct({ id: Schema.String }));
          const item = yield* store.find(id);
          if (Option.isNone(item)) return HttpServerResponse.empty({ status: 404 });
          return yield* HttpServerResponse.schemaJson(Item)(item.value);
        }),
      ),
    ];
  }),
);
const healthRoute = HttpRouter.add("GET", "/health", HttpServerResponse.text("ok"));

export const httpLayer = (input: { readonly port: number }) =>
  HttpRouter.serve(Layer.mergeAll(itemRoutes, healthRoute)).pipe(
    Layer.provide(NodeHttpServer.layer(createServer, input)),
  );
```

At the entry: `Layer.launch(httpLayer({ port }).pipe(Layer.provide(itemStoreLayer))).pipe(NodeRuntime.runMain)`.
Decode a body with `HttpServerRequest.schemaBodyJson(S)` and a query with `HttpServerRequest.schemaSearchParams(S)`.
For a fetch-style host, `HttpRouter.toWebHandler(routes.pipe(Layer.provide(HttpServer.layerServices)))` returns `{ handler, dispose }`.
**Gotchas**

- `toWebHandler` builds the layer when called, not on the first request.
- A `SchemaError` failure becomes 400, even from a corrupt store row. Map store errors first.
- A `NoSuchElementError` failure becomes 404. Every other failure, like `StoreError`, becomes 500.

## HttpApi

**Use** `HttpApi` from `effect/http-api` for a JSON API with clients. **Not** for 1-3 trivial routes — use `HttpRouter`.
**Why:** one contract gives decoding, a typed `HttpApiClient`, and OpenAPI.
Define `HttpApi` > `HttpApiGroup` > `HttpApiEndpoint` once, apart from server code. Implement each group with `HttpApiBuilder.group`.
`HttpApiBuilder.layer(Api)` registers every group. Serve it like routes: `HttpRouter.serve` or `HttpRouter.toWebHandler`.
Set an error's status in its schema: `{ httpApiStatus: 404 }` as the third `Schema.TaggedError` argument. A success status is `Item.pipe(HttpApiSchema.status(201))`.

```ts
import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter } from "effect/http";
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/http-api";

class Item extends Schema.Class<Item>("Item")({ id: Schema.String, name: Schema.String }) {}
class ItemMissing extends Schema.TaggedError<ItemMissing>()(
  "ItemMissing",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}

class ItemsGroup extends HttpApiGroup.make("items").add(
  HttpApiEndpoint.get("get", "/items/:id", {
    params: { id: Schema.String },
    success: Item,
    error: ItemMissing,
  }),
) {}
class Api extends HttpApi.make("app").add(ItemsGroup) {}

const itemsById: ReadonlyMap<string, Item> = new Map([["a", new Item({ id: "a", name: "Anvil" })]]);

const itemsHandlers = HttpApiBuilder.group(Api, "items", (handlers) =>
  handlers.handle(
    "get",
    Effect.fn("ItemsApi.get")(function* ({ params }) {
      const item = itemsById.get(params.id);
      if (item === undefined) return yield* new ItemMissing({ id: params.id });
      return item;
    }),
  ),
);

const apiLayer = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(itemsHandlers),
);
const testServer = HttpRouter.serve(apiLayer).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

layer(testServer)("Api over a real local server", (it) => {
  it.effect("returns the item and a typed 404", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api);
      assert.strictEqual((yield* client.items.get({ params: { id: "a" } })).name, "Anvil");
      const missing = yield* client.items.get({ params: { id: "zz" } }).pipe(Effect.flip);
      assert.strictEqual(missing._tag, "ItemMissing");
    }),
  );
});
```

A group that needs a service yields it once: `(handlers) => Effect.gen(function* () { ... })`.
`OpenApi.fromApi(Api)` returns the spec without serving it.

## Testing

**Own HttpApi.** `HttpApiTest.groups(Api, ["items"])` is a typed client over the real handlers, with no socket. Provide the group layers and `HttpServer.layerServices`.
**Over a socket.** `NodeHttpServer.layerTest` starts a real server on port 0. Its `HttpClient` already points at it. Do not add `prependUrl` or `baseUrl`.
**Vendor clients** prepend their own base URL. Serve fixture routes with `HttpRouter.serve` on `NodeHttpServer.layer(createServer, { port: 0, host: "127.0.0.1" })`.
Build the client with `Layer.unwrap(HttpServer.addressFormattedWith((baseUrl) => Effect.succeed(catalogLayer({ baseUrl, apiKey }))))` and a plain `FetchHttpClient.layer`.
Retry delays wait on `TestClock` inside `it.effect`. Run real-server retry tests under `layer(L, { excludeTestServices: true })`.
A fixture server proves your decoding, not the vendor's current behavior.

## Fail review on

```ts
Effect.tryPromise(() => fetch(`${baseUrl}/products/${id}`).then((response) => response.json()));
```

Use `client.get(path)` and `HttpClientResponse.schemaBodyJson(Product)`.

```ts
client.pipe(HttpClient.retryTransient({ schedule: Schedule.exponential("1 second") }));
```

Add `times`. Without it, the client retries forever.

```ts
Layer.effect(Catalog, makeCatalog).pipe(Layer.provide(FetchHttpClient.layer));
```

Provide the transport once, at the root.

## Upstream

`node_modules/effect/ai-docs/src/50_http-client/10_basics.ts`, `node_modules/effect/ai-docs/src/51_http-server/10_basics.ts`, `node_modules/effect/ai-docs/src/51_http-server/20_testing.ts`
