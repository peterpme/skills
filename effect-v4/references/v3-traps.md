# v3 traps

You wrote a v3 or prerelease name. Write the 4.0.0 name.
Every left cell fails to compile on 4.0.0. **Runtime** rows compile and misbehave.
"(beta)" and "(rc)" mark 4.0.0 prerelease names. Model memory and old repos still use them.

## Imports

| You wrote                                                                  | Write                                                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `effect/unstable/http`, `effect/unstable/sql`, `effect/unstable/<area>`    | `effect/http`, `effect/sql`, `effect/<area>`                                            |
| `effect/unstable/httpapi`, `effect/http/HttpApi`                           | `effect/http-api`                                                                       |
| `@effect/platform`                                                         | `effect/http`; `FileSystem`, `Path` from `effect`; `ChildProcess` from `effect/process` |
| `@effect/sql`, `@effect/ai`, `@effect/schema`                              | `effect/sql`, `effect/ai`, `Schema` from `effect`, `Model` from `effect/schema`         |
| `Encoding` from `effect`, `effect/Encoding`                                | `Base64`, `Hex` from `effect/encoding`                                                  |
| `NodeContext.layer`                                                        | `NodeServices.layer` from `@effect/platform-node`                                       |
| `TestClock` from `effect` or `effect/TestClock`                            | `import { TestClock } from "effect/testing"`                                            |
| `FastCheck` from `effect`, `effect/testing/FastCheck`, `Arbitrary.make(S)` | `it.prop(name, [S], f)`, `Arbitrary.schema(S)`                                          |

## Services, layers, runtime

| You wrote                                                                                                 | Write                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Context.Tag("X")<X, Shape>()`, `Context.GenericTag<Shape>("X")`, `ServiceMap.Service` (beta)             | `class X extends Context.Service<X, Shape>()("@app/area/X") {}`                                           |
| `Effect.Service<X>()("X", { effect, dependencies })`, `Effect.Tag`                                        | `Context.Service` plus `Layer.effect(X, make)`                                                            |
| `X.method(...)` accessors, `Effect.serviceFunctions`, `X.asEffect()` (beta)                               | `const x = yield* X`, or `X.use((x) => x.method(...))`                                                    |
| `Layer.scoped`, `Layer.scopedDiscard`                                                                     | `Layer.effect`, `Layer.effectDiscard`. They handle `Scope`.                                               |
| `Layer.unwrapEffect`, `Layer.unwrapScoped`, `Layer.catchAll`                                              | `Layer.unwrap`, `Layer.catch`                                                                             |
| `Layer.toRuntime`, `Runtime.runPromise(runtime)`, `Effect.runtime<R>()`, `Effect.provideSomeLayer(layer)` | `ManagedRuntime.make(layer)`; `Effect.context<R>()` with `Effect.runPromiseWith`; `Effect.provide(layer)` |
| `FiberRef`, `Effect.locally(ref, value)`, `ServiceMap.Reference` (beta)                                   | `Context.Reference`, then `Effect.provideService(reference, value)`                                       |

## Effects and combinators

| You wrote                                                                            | Write                                                                                                 |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `Effect.catchAll`, `catchAllCause`, `catchAllDefect`, `tapErrorCause`                | `Effect.catch`, `Effect.catchCause`, `Effect.catchDefect`, `Effect.tapCause`                          |
| `Effect.catchSome((e) => Option)`, `Effect.catchSomeCause`                           | `Effect.catchIf(predicate, handler)`, `Effect.catchCauseIf`                                           |
| `Effect.orElse`, `Effect.orElseFail`, `Effect.tapBoth`                               | `Effect.catch`, `Effect.mapError`, `Effect.tap` plus `Effect.tapError`                                |
| `Effect.zipRight`, `zipLeft`, `andThen((a) => plainValue)`, `andThen(() => promise)` | `Effect.andThen(next)`, `Effect.tap(next)`, `Effect.map(f)`, `Effect.tryPromise`                      |
| `Effect.fork`, `Effect.forkDaemon`, `Effect.async`                                   | `Effect.forkChild`, `Effect.forkDetach`, `Effect.forkScoped`, `Effect.callback((resume) => ...)`      |
| `Effect.makeSemaphore`, `makeLatch`, `unit`, `asUnit`, `dieMessage(m)`               | `Semaphore.make(permits)`, `Latch.make()`, `Effect.void`, `Effect.asVoid`, `Effect.die(new Error(m))` |
| `Effect.validateAll`, `{ mode: "either" }`, `{ mode: "validate" }`                   | `Effect.validate(xs, f)`, `Effect.all(xs, { mode: "result" })`                                        |
| `{ concurrency: "inherit" }`, `Effect.withConcurrency(n)`                            | `{ concurrency: n }` or `{ concurrency: "unbounded" }` on each call                                   |
| `Effect.timeoutFail`, `Effect.timeoutTo`                                             | `Effect.timeoutOrElse({ duration, orElse })`                                                          |
| `Effect.if`, `Effect.unless`, `Effect.when(() => bool)`                              | `if` inside `Effect.gen`; `Effect.when(effectOfBoolean)` returns `Option`                             |
| `Effect.repeatN(n)`, `Effect.optionFromOptional`                                     | `Effect.repeat({ times: n })`, `Effect.catchNoSuchElement`                                            |
| `const [failures, successes] = yield* Effect.partition(...)`                         | `const [successes, failures]`. **Runtime**: the order flipped at 4.0.0.                               |

## Errors, Cause, Exit

| You wrote                                                                     | Write                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Either`, `Effect.either`, `Either.right`, `Either.left`, `.right`, `.left`   | `Result`, `Effect.result`, `Result.succeed`, `Result.fail`, `.success`, `.failure`               |
| `Schema.TaggedErrorClass` (beta), `Schema.ErrorClass` (beta)                  | `Schema.TaggedError<Self>()("Tag", fields)`, `Schema.Error<Self>("Id")(fields)`                  |
| `Cause.UnknownException`, `TimeoutException`, `NoSuchElementException`        | `Cause.UnknownError`, `Cause.TimeoutError`, `Cause.NoSuchElementError`. The tag is the new name. |
| `Cause.failureOption`, `Cause.failures`, `Exit.causeOption`                   | `Cause.findErrorOption`, `cause.reasons.filter(Cause.isFailReason)`, `Exit.getCause`             |
| `Cause.isFailure`, `Cause.isDie`, `Cause.isInterrupted`, `Exit.isInterrupted` | `Cause.hasFails`, `Cause.hasDies`, `Cause.hasInterrupts`, `Exit.hasInterrupts`                   |
| `Schema.ParseError`, `ParseResult`                                            | `Schema.SchemaError`. Read `.issue`.                                                             |

## Schema

| You wrote                                                                          | Write                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Schema.decodeUnknown(S)`, `decode(S)`, `decodeUnknownEither`, `decodeEither`      | `Schema.decodeUnknownEffect(S)`, `decodeEffect(S)`, `decodeUnknownResult`, `decodeResult`. `Schema.decode` is now a transform. |
| `Schema.Literal("a", "b")`, `Union(A, B)`, `Tuple(A, B)`, `Record({ key, value })` | `Schema.Literals(["a", "b"])`, `Union([A, B])`, `Tuple([A, B])`, `Record(key, value)`                                          |
| `Schema.optionalWith(S, { exact: true })`, `{ default }`                           | `Schema.optionalKey(S)`, `S.pipe(Schema.withDecodingDefaultKey(Effect.succeed(v)))`                                            |
| `Schema.parseJson(S)`                                                              | `Schema.fromJsonString(S)`                                                                                                     |
| `Schema.minLength(1)`, `pattern(r)`, `positive()`, `filter(f)`, `Schema.UUID`      | `S.check(Schema.isMinLength(1))`, `isPattern(r)`, `isGreaterThan(0)`, `makeFilter(f)`, `isUUID()`                              |
| `Schema.isStartsWith`, `Schema.isLengthBetween` (rc)                               | `Schema.isStartingWith`, `Schema.isBetweenLength(min, max)`                                                                    |
| `Schema.transform`, `Schema.transformOrFail`, `SchemaGetter.transformOrFail` (rc)  | `From.pipe(Schema.decodeTo(To, SchemaTransformation.transform({ decode, encode })))`, `SchemaTransformation.transformEffect`   |
| `S.annotations({ ... })`, `S.pick("a")`, `Schema.extend`                           | `S.annotate({ ... })`, `S.mapFields(Struct.pick(["a"]))`, `S.pipe(Schema.fieldsAssign({ ... }))`                               |
| `Schema.DateFromSelf`, `OptionFromSelf`, `Enums`, `encodedSchema`, `typeSchema`    | `Schema.Date`, `Schema.Option(S)`, `Schema.Enum`, `Schema.toEncoded`, `Schema.toType`                                          |
| `Schema.Date` for an ISO string field                                              | `Schema.DateFromString`. **Runtime**: `Schema.Date` is the `Date` instance and rejects strings.                                |

## Config, data, option

| You wrote                                                                                       | Write                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Config.string`, `number`, `integer`, `boolean`, `port`, `redacted`, `secret`                   | `Config.String`, `Config.Number`, `Config.Int`, `Config.Boolean`, `Config.Port`, `Config.Redacted`                            |
| `Config.array(Config.string(), "X")`, `Config.mapOrFail`                                        | `Config.Array(Schema.String, "X")`, `Config.mapEffect`                                                                        |
| `Layer.setConfigProvider(ConfigProvider.fromMap(...))`, `fromJson`, `Effect.withConfigProvider` | `ConfigProvider.layer(ConfigProvider.fromUnknown({ ... }))`, `Effect.provideService(ConfigProvider.ConfigProvider, provider)` |
| `Option.fromNullable`, `Option.getRight`, `Predicate.isNullable`                                | `Option.fromNullishOr` (`fromNullOr` for `null` only), `Option.getSuccess`, `Predicate.isNullish`                             |
| `Data.struct({ ... })`, `Data.case`, `Data.tagged`                                              | A plain object. `Equal.equals` compares it structurally. `Data.Class`, `Data.taggedEnum` for constructors.                    |
| `Ref.unsafeMake`, `Chunk.unsafeGet`, `Context.unsafeGet`, `Context.getReferenceUnsafe` (beta)   | `Ref.makeUnsafe`, `Chunk.getUnsafe`, `Context.getUnsafe`. `Unsafe` is a suffix now.                                           |
| `Duration.decode(input)`, `Duration.DurationInput`, `Random.nextRange`                          | `Duration.fromInputUnsafe(input)`, `Duration.Input`, `Random.nextBetween`                                                     |
| `Metric.increment(counter)`, `Metric.tagged(metric, key, value)`                                | `Metric.update(counter, 1)`, `Metric.withAttributes(metric, { key: value })`                                                  |

## HTTP and SQL

| You wrote                                                                                             | Write                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `HttpRouter.empty.pipe(HttpRouter.get("/x", handler))`                                                | `HttpRouter.add("GET", "/x", handler)` layers, served by `HttpRouter.serve(routes)`                           |
| `HttpApiEndpoint.get("get", "/x").addSuccess(S)`, `HttpApiBuilder.api(Api)`, `HttpApiBuilder.serve()` | `HttpApiEndpoint.get("get", "/x", { success: S, error: E })`, `HttpApiBuilder.layer(Api)`, `HttpRouter.serve` |
| `SqlSchema.findOne` read as `Option`                                                                  | `SqlSchema.findOneOption`. `findOne` fails with `NoSuchElementError`.                                         |

## Schedule, stream, logger, testing

| You wrote                                                                             | Write                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Schedule.andThen`, `intersect`, `compose`, `union`, `whileInput(p)`                  | `Schedule.concat`, `Schedule.max([a, b])` (both recur), `Schedule.min([a, b])` (either recurs), `Schedule.while(({ input }) => p(input))` |
| `Stream.async`, `Stream.catchAll`, `paginateEffect`, `repeatEffect`                   | `Stream.callback((queue) => ...)`, `Stream.catch`, `Stream.paginate`, `Stream.fromEffectRepeat`                                           |
| `Chunk.toReadonlyArray(yield* Stream.runCollect(s))`                                  | `yield* Stream.runCollect(s)`. It returns an `Array`.                                                                                     |
| `Logger.replace(Logger.defaultLogger, l)`, `Logger.add(l)`                            | `Logger.layer([l])`, `Logger.layer([l], { mergeWithExisting: true })`                                                                     |
| `Logger.json`, `Logger.minimumLogLevel(LogLevel.Debug)`, `Logger.withMinimumLogLevel` | `Logger.consoleJson`, `Layer.succeed(References.MinimumLogLevel, "Debug")`, `Effect.provideService(References.MinimumLogLevel, "Debug")`  |
| `it.scoped(name, f)`, `it.scopedLive`                                                 | `it.effect`, `it.live`. Both provide `Scope`. `it.scoped` is vitest's fixture API.                                                        |

## Check

Three language-service hints are wrong for 4.0.0. Trust the table:

- `validateAll` → `{ mode: "validate" }` does not exist. Use `Effect.validate`.
- `timeoutFail` → the tag is `TimeoutError`, not `TimeoutException`. Use `Effect.timeoutOrElse`.
- `optionFromOptional` → `Effect.option` turns every error into `None`. Use `Effect.catchNoSuchElement`.

It gives no hints outside `Effect.*`. `Layer`, `Context`, `Schema`, `Config`, `Cause`, `Schedule`, `Stream`, and `Logger` names fail as plain type errors.
The language service flags many of these rows as `outdatedApi`. Run the typecheck.
