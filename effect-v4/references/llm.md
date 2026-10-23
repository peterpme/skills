# LLM calls

Calling a model from Effect: the Vercel AI SDK or Effect AI, behind one domain contract.

## Which one

**Use** Effect AI (`effect/ai` + `@effect/ai-*`) for OpenAI, Anthropic, OpenAI-compatible endpoints, and OpenRouter. **Not** for Google, gateways that bend the wire format, provider-specific structured-output modes, or the AI SDK UI stream protocol — use the Vercel AI SDK (`ai` 7).
**Why:** Effect AI is Effect-native: typed error reasons, built-in spans, `ExecutionPlan`, a fifth of the bundle. The AI SDK covers more providers and tolerates odd responses.
Put either behind one domain service. Callers see `Summarizer.summarize(text)` and `LlmError`, never the SDK.

| Need                            | Vercel AI SDK                                                                        | Effect AI                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Providers                       | `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai-compatible` | `@effect/ai-openai`, `@effect/ai-anthropic`, `@effect/ai-openai-compat`, `@effect/ai-openrouter`. No Google. |
| A gateway that bends the format | Lenient parse. Raw body via `include: { responseBody: true }`.                       | Strict decode. A bad 200 is a retryable `InvalidOutputError`.                                                |
| Streaming                       | Bridge `result.stream` into a `Stream` yourself.                                     | `streamText` returns a `Stream`.                                                                             |
| Tools                           | `tool({ execute })` returns a Promise.                                               | `Tool.make` handlers are Effects with services.                                                              |
| Errors                          | `APICallError.isRetryable`. A quota 429 counts as retryable.                         | `AiError` reasons with `isRetryable` and `retryAfter`.                                                       |
| Tracing, fallback               | Your `Effect.fn` spans. Fallback by hand.                                            | Built-in `gen_ai.*` spans. `ExecutionPlan`.                                                                  |
| Bundle, one provider            | +164 KB gzip, measured.                                                              | +34 KB gzip, measured.                                                                                       |

## Contract

**Use** one `LlmError` and one `LlmPolicy` for every model call. **Not** SDK errors in `E` — callers would branch on the SDK.
**Why:** `retryable` is the only field the policy reads, so both recipes plug in.

- `LlmPolicy.run(operation, attempt)`: attempt timeout (retryable), retry bounded by `times` with jittered backoff, then a deadline (not retryable). [time](time.md) explains the order.
- `llmPolicyLayer(settings)` takes required values from the config module. The API key arrives from the entry as a `Redacted` value.
- The policy is the one retry owner. Set AI SDK `maxRetries: 0`. Effect AI providers do not retry.

```ts
import { assert, it } from "@effect/vitest";
import { Context, Duration, Effect, Fiber, Layer, Ref, Schedule, Schema } from "effect";
import { TestClock } from "effect/testing";

export class LlmError extends Schema.TaggedError<LlmError>()("LlmError", {
  operation: Schema.String,
  status: Schema.NullOr(Schema.Int),
  retryable: Schema.Boolean,
  cause: Schema.Defect(),
}) {}
export class LlmPolicy extends Context.Service<
  LlmPolicy,
  {
    run<A>(operation: string, attempt: Effect.Effect<A, LlmError>): Effect.Effect<A, LlmError>;
  }
>()("@app/llm/LlmPolicy") {}
export interface LlmSettings {
  readonly attemptTimeout: Duration.Input;
  readonly retries: number;
  readonly retryBase: Duration.Input;
  readonly deadline: Duration.Input;
}
const timedOut = (operation: string, retryable: boolean) =>
  new LlmError({
    operation,
    status: null,
    retryable,
    cause: retryable ? "attempt timed out" : "deadline exceeded",
  });
export const llmPolicyLayer = (settings: LlmSettings) =>
  Layer.succeed(
    LlmPolicy,
    LlmPolicy.of({
      run: Effect.fn("LlmPolicy.run")(<A>(operation: string, attempt: Effect.Effect<A, LlmError>) =>
        attempt.pipe(
          Effect.timeoutOrElse({
            duration: settings.attemptTimeout,
            orElse: () => Effect.fail(timedOut(operation, true)),
          }),
          Effect.retry({
            while: (error) => error.retryable,
            times: settings.retries,
            schedule: Schedule.exponential(settings.retryBase).pipe(Schedule.jittered),
          }),
          Effect.timeoutOrElse({
            duration: settings.deadline,
            orElse: () => Effect.fail(timedOut(operation, false)),
          }),
        ),
      ),
    }),
  );
const settings: LlmSettings = {
  attemptTimeout: "10 seconds",
  retries: 2,
  retryBase: "1 second",
  deadline: "1 minute",
};
it.effect("LlmPolicy stops after the retry budget", () =>
  Effect.gen(function* () {
    const calls = yield* Ref.make(0);
    const busy = new LlmError({ operation: "op", status: 503, retryable: true, cause: "busy" });
    const attempt = Ref.update(calls, (n) => n + 1).pipe(Effect.andThen(Effect.fail(busy)));
    const fiber = yield* Effect.forkChild(Effect.flip((yield* LlmPolicy).run("op", attempt)));
    yield* TestClock.adjust("1 minute");
    assert.strictEqual((yield* Fiber.join(fiber)).status, 503);
    assert.strictEqual(yield* Ref.get(calls), 3);
  }).pipe(Effect.provide(llmPolicyLayer(settings))),
);
```

## Two implementations

**Use** one `Summarizer` service with a layer per SDK. **Not** an SDK type in any caller.
**Why:** `summarizerLayer` and `effectAiSummarizerLayer` provide the same service. The root picks one.
**Vercel AI SDK:** wrap `generateText` in `Effect.tryPromise({ try: (signal) => ..., catch })`. `signal` aborts the request on interrupt. Never `Effect.promise`: a rejection becomes a defect.
**Effect AI:** capture `LanguageModel.LanguageModel` in `Layer.effect` and provide one provider layer. Never `layerConfig`: it reads env below the entry.

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { assert, it } from "@effect/vitest";
import { APICallError, generateText, NoObjectGeneratedError, Output } from "ai";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { AiError, LanguageModel, Prompt } from "effect/ai";

class LlmError extends Schema.TaggedError<LlmError>()("LlmError", {
  operation: Schema.String,
  status: Schema.NullOr(Schema.Int),
  retryable: Schema.Boolean,
  cause: Schema.Defect(),
}) {}
class LlmPolicy extends Context.Service<
  LlmPolicy,
  { run<A>(operation: string, attempt: Effect.Effect<A, LlmError>): Effect.Effect<A, LlmError> }
>()("@app/llm/LlmPolicy") {}
const Summary = Schema.Struct({
  title: Schema.String,
  bullets: Schema.Array(Schema.String),
  at: Schema.Date,
});
class Summarizer extends Context.Service<
  Summarizer,
  { summarize(text: string): Effect.Effect<typeof Summary.Type, LlmError> }
>()("@app/llm/Summarizer") {}
const summaryInstructions =
  "Summarize the text as a title, three bullets, and the date it describes.";
const operation = "Summarizer.summarize";
const withPolicy = (
  summarizeOnce: (text: string) => Effect.Effect<typeof Summary.Type, LlmError>,
) =>
  Effect.gen(function* () {
    const policy = yield* LlmPolicy;
    return Summarizer.of({
      summarize: Effect.fn(operation)((text: string) => policy.run(operation, summarizeOnce(text))),
    });
  });

export const summarySchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(Schema.toCodecJson(Summary)),
);
export const sdkError = (cause: unknown) =>
  new LlmError({
    operation,
    cause,
    status: APICallError.isInstance(cause) ? (cause.statusCode ?? null) : null,
    retryable: APICallError.isInstance(cause)
      ? cause.isRetryable
      : NoObjectGeneratedError.isInstance(cause) && cause.finishReason === "stop",
  });
export const summarizerLayer = (input: {
  readonly apiKey: Redacted.Redacted;
  readonly model: string;
  readonly maxOutputTokens: number;
}) => {
  const model = createOpenAI({ apiKey: Redacted.value(input.apiKey) }).responses(input.model);
  const output = Output.object({ schema: summarySchema, name: "summary" });
  return Layer.effect(
    Summarizer,
    withPolicy((text) =>
      Effect.tryPromise({
        try: (signal) =>
          generateText({
            model,
            instructions: summaryInstructions,
            prompt: text,
            output,
            maxOutputTokens: input.maxOutputTokens,
            maxRetries: 0,
            abortSignal: signal,
          }).then((result) => result.output),
        catch: sdkError,
      }),
    ),
  );
};

const aiError = (error: AiError.AiError) =>
  new LlmError({
    operation,
    retryable: error.isRetryable,
    cause: error,
    status: "http" in error.reason ? (error.reason.http?.response?.status ?? null) : null,
  });
export const effectAiSummarizerLayer = Layer.effect(
  Summarizer,
  Effect.gen(function* () {
    const model = yield* LanguageModel.LanguageModel;
    return yield* withPolicy((text) =>
      model
        .generateObject({
          prompt: Prompt.make(text).pipe(Prompt.setSystem(summaryInstructions)),
          schema: Summary,
          objectName: "summary",
        })
        .pipe(
          Effect.map((response) => response.value),
          Effect.mapError(aiError),
        ),
    );
  }),
);
export const openAiModelLayer = (input: {
  readonly apiKey: Redacted.Redacted;
  readonly model: string;
  readonly maxOutputTokens: number;
}) =>
  OpenAiLanguageModel.layer({
    model: input.model,
    config: { max_output_tokens: input.maxOutputTokens },
  }).pipe(Layer.provide(OpenAiClient.layer({ apiKey: input.apiKey })));

const failedWith = (statusCode: number) =>
  new APICallError({
    message: "upstream",
    url: "https://llm.example",
    requestBodyValues: {},
    statusCode,
  });
it("sdkError keeps the SDK retry verdict", () =>
  assert.deepStrictEqual(
    [429, 503, 400].map((code) => sdkError(failedWith(code)).retryable),
    [true, true, false],
  ));
it("summarySchema decodes model JSON into the Type", async () => {
  const result = await summarySchema["~standard"].validate({
    title: "t",
    bullets: [],
    at: "2026-01-01T00:00:00.000Z",
  });
  assert.isTrue("value" in result && result.value.at instanceof Date);
});
```

**Vercel AI SDK gotchas**

- `instructions` replaces `system` in `ai` 7. `generateObject` is deprecated: pass `output: Output.object(...)` to `generateText`.
- Read `result.output` inside `.then`. The getter throws `NoOutputGeneratedError`, and in `Effect.map` that is a defect.
- Build the adapter on `Schema.toCodecJson(S)`. Without it, the SDK checks the model's JSON against the `Type`: `Schema.Date` fails. The converters also mutate `S` in place.
- `@ai-sdk/openai` defaults to strict mode, which rejects optional keys. Use `Schema.NullOr(X)` for absent values. Use `Schema.Finite`: `Schema.Number` also admits `"NaN"`.
- `isRetryable` is true for 408, 409, 429, 5xx, and network failures, quota 429s included. Check `responseBody` when spend matters.
- A cut-off answer fails as `NoObjectGeneratedError` with `finishReason: "length"`, or `NoOutputGeneratedError` when empty. `sdkError` retries neither. Raise `maxOutputTokens`. A cut-off plain `result.text` succeeds: check `result.finishReason`.
- `createAnthropic({ apiKey })(model)` swaps the provider in one line. The SDK owns its `fetch`; the `HttpClient` rule covers hand-written HTTP.
- Stream `streamText(...).stream` through `Stream.fromAsyncIterable` in `Stream.unwrap`, aborting via `Effect.acquireRelease`. Fail on `error` parts: `textStream` drops them and ends as a success.

**Tools.** `tool({ inputSchema, execute })` runs an Effect handler. `inputSchema` takes the same adapter. `execute` is a Promise boundary the SDK calls, the one run allowed below the entry.

- In the layer: `const run = Effect.runPromiseWith(yield* Effect.context<never>())`. Then `execute: (input, { abortSignal }) => run(store.price(input.id), { signal: abortSignal })`.
- A rejection becomes `error-text` for the model. Map expected failures to a success value first.
- Set `stopWhen: isStepCount(n)`. The default is one step: tools run, but the model never sees the results.

**Effect AI gotchas**

- Pass the domain schema. The provider rewrites it for strict mode, so `Schema.Date` and `Schema.optional` work.
- No `system` option. Use `Prompt.setSystem`, or pass `[{ role: "system", content }, { role: "user", content }]`.
- Wire it at the root: `effectAiSummarizerLayer.pipe(Layer.provide([openAiModelLayer(input), llmPolicyLayer(settings)]), Layer.provide(FetchHttpClient.layer))`. Provider layers need `HttpClient`.
- `AiError.reason` is the kind; `isRetryable` and `retryAfter` delegate to it. Retryable: `RateLimitError`, `InternalProviderError`, `InvalidOutputError`, `StructuredOutputError`, transport `NetworkError`. Not: `QuotaExhaustedError`, `AuthenticationError`, `InvalidRequestError`, `ContentPolicyError`.
- `aiError` drops `retryAfter`. To honour it, add it to `LlmError` and read it in `Schedule.modifyDelay` ([time](time.md)).
- Narrow one reason before `aiError`: `Effect.catchReason("AiError", "ContentPolicyError", f)`. The rest stay in `E`.
- A cut-off object fails as a retryable `StructuredOutputError`. Size `max_output_tokens` so the object fits.
- `model.streamText({ prompt })` returns a `Stream` of parts. Fail on its in-band `error` parts too.
- Anthropic: `AnthropicLanguageModel.layer({ model, config: { max_tokens } })` over `AnthropicClient.layer({ apiKey })`.
- Fallback: `ExecutionPlan.make({ provide: OpenAiLanguageModel.model(a), attempts: 2 }, { provide: AnthropicLanguageModel.model(b) })`. Capture it in the layer with `yield* plan.captureRequirements`.
- Run `LanguageModel.generateObject` under `Effect.withExecutionPlan(plan)`. A captured `model` ignores the plan. The plan owns retries: set the policy's `retries` to `0`.

## Effect AI tools

**Use** `Tool.make` + `Toolkit.make(...).toLayer(handlers)` when the model calls your services. **Not** for one structured answer — use `generateObject`.
**Why:** handlers are Effects. Params and results pass through the tool schemas.

```ts
import { Context, Effect, Layer, Schema } from "effect";
import { AiError, Chat, LanguageModel, Tool, Toolkit } from "effect/ai";

class LlmError extends Schema.TaggedError<LlmError>()("LlmError", {
  operation: Schema.String,
  status: Schema.NullOr(Schema.Int),
  retryable: Schema.Boolean,
  cause: Schema.Defect(),
}) {}
class ItemMissing extends Schema.TaggedError<ItemMissing>()("ItemMissing", { id: Schema.String }) {}
class ItemStore extends Context.Service<
  ItemStore,
  { price(id: string): Effect.Effect<number, ItemMissing> }
>()("@app/store/ItemStore") {}
class Assistant extends Context.Service<
  Assistant,
  { answer(question: string): Effect.Effect<string, LlmError> }
>()("@app/llm/Assistant") {}
const ItemPrice = Tool.make("ItemPrice", {
  description: "Current price of an item by id",
  parameters: Schema.Struct({ id: Schema.String }),
  success: Schema.Finite,
  failure: ItemMissing,
  failureMode: "return",
});
const ItemTools = Toolkit.make(ItemPrice);
const itemToolsLayer = ItemTools.toLayer(
  Effect.gen(function* () {
    const store = yield* ItemStore;
    return ItemTools.of({ ItemPrice: ({ id }) => store.price(id) });
  }),
);
const loopFailed = (cause: AiError.AiError | string) =>
  new LlmError({ operation: "Assistant.answer", status: null, retryable: false, cause });
export const assistantLayer = (input: { readonly maxSteps: number }) =>
  Layer.effect(
    Assistant,
    Effect.gen(function* () {
      const model = yield* LanguageModel.LanguageModel;
      const tools = yield* ItemTools;
      return Assistant.of({
        answer: Effect.fn("Assistant.answer")(
          function* (question: string) {
            const chat = yield* Chat.fromPrompt(question);
            for (let step = 0; step < input.maxSteps; step++) {
              const response = yield* chat
                .generateText({ prompt: [], toolkit: tools })
                .pipe(Effect.mapError(loopFailed));
              if (response.toolCalls.length === 0) return response.text;
            }
            return yield* loopFailed("step limit");
          },
          Effect.provideService(LanguageModel.LanguageModel, model),
        ),
      });
    }),
  ).pipe(Layer.provide(itemToolsLayer));
```

**Gotchas**

- `generateText` runs the tool calls but does not call the model again. Loop with `Chat`, bounded by `maxSteps`. Loop failures are not retryable: the tools already ran.
- `Chat` reads `LanguageModel` from context. The method provides the captured `model`.
- `failureMode: "return"` sends a typed failure to the model. The default `"error"` fails the call.

## Testing

**Use** deterministic tests for the parts you own: the policy on `TestClock`, the classifier and adapter on real SDK values (fences above). **Not** a scripted model.
**Why:** a scripted model proves only its script. Prove each model with a live run.

- `MockLanguageModelV4` from `ai/test` and `LanguageModel.make` replace the model. They count as fakes. Do not use them by default.
- Provider error mapping over real HTTP needs a local server. Point `baseURL` or `apiUrl` at it. [http](http.md) shows a fixture server.

## Fail review on

```ts
Effect.tryPromise({
  try: (signal) => generateText({ model, prompt, output, abortSignal: signal }),
  catch: sdkError,
}).pipe(Effect.map((result) => result.output));
```

Read `.output` inside `.then` and set `maxRetries: 0`. Here a missing output is a defect, and the SDK retries under your policy.

```ts
Output.object({ schema: Schema.toStandardSchemaV1(Schema.toStandardJSONSchemaV1(Summary)) });
```

Wrap `Summary` in `Schema.toCodecJson` first. This validates the `Type` against JSON and mutates `Summary`.

<!-- prettier-ignore -->
```ts
while (true) {
  const response = yield* chat.generateText({ prompt: [], toolkit })
  if (response.toolCalls.length === 0) return response.text
}
```

Bound the loop with a step count. A model that keeps calling tools never stops.

## Upstream

`node_modules/effect/ai-docs/src/71_ai/10_language-model.ts`, `node_modules/effect/ai-docs/src/71_ai/20_tools.ts`, `node_modules/effect/ai-docs/src/71_ai/30_chat.ts`
