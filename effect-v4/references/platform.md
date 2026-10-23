# Platform

Files, paths, child processes, CLIs, encodings, and the process entry point.

| Need                                 | Use                                                                           | Import                  |
| ------------------------------------ | ----------------------------------------------------------------------------- | ----------------------- |
| Read or write files, build paths     | `FileSystem.FileSystem`, `Path.Path`                                          | `"effect"`              |
| Run a command                        | `ChildProcessSpawner` + `ChildProcess.make`                                   | `effect/process`        |
| Flags and subcommands                | `Command`, `Flag`, `Argument`                                                 | `effect/cli`            |
| Start a Node process                 | `NodeRuntime.runMain`                                                         | `@effect/platform-node` |
| UUIDs, digests, secure bytes         | `Crypto.Crypto`: `randomUUIDv7`, `randomBytes(n)`, `digest("SHA-256", bytes)` | `"effect"`              |
| Base64, Hex, YAML, TOML, NDJSON, SSE | See [Encoding](#encoding)                                                     | `effect/encoding`       |

`FileSystem`, `Path`, `Stdio`, `Terminal`, and `Crypto` are core interfaces. `NodeServices.layer` implements all five plus `ChildProcessSpawner`.
Provide it once, at the entry. Bun and Deno mirror it: `BunServices.layer`, `DenoServices.layer`. Edge runtimes have no file system and no child processes.

## FileSystem

**Use** `FileSystem.FileSystem` for every file read, write, or directory walk. **Not** `node:fs`.
**Why:** failures arrive typed as `PlatformError`, and tests run against a real temp directory.
Essentials: `readFileString`, `writeFileString`, `makeDirectory(dir, { recursive: true })`, `exists`, `readDirectory`, `remove`.
`stream(path)` emits bytes. Pipe `Stream.decodeText()` and `Stream.splitLines` for lines. Build paths with `Path.Path`: `join`, `resolve`.

```ts
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Option, Path, PlatformError } from "effect";

class ItemFiles extends Context.Service<
  ItemFiles,
  {
    read(id: string): Effect.Effect<Option.Option<string>, PlatformError.PlatformError>;
    write(id: string, text: string): Effect.Effect<void, PlatformError.PlatformError>;
  }
>()("@app/store/ItemFiles") {}
const itemFilesLayer = (input: { readonly root: string }) =>
  Layer.effect(
    ItemFiles,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fileFor = (id: string) => path.join(input.root, `${id}.txt`);
      return ItemFiles.of({
        read: Effect.fn("ItemFiles.read")((id: string) =>
          fs.readFileString(fileFor(id)).pipe(
            Effect.asSome,
            Effect.catchReason("PlatformError", "NotFound", () => Effect.succeedNone),
          ),
        ),
        write: Effect.fn("ItemFiles.write")((id: string, text: string) =>
          fs.writeFileString(fileFor(id), text),
        ),
      });
    }),
  );
it.effect("writes into a temp dir and maps a missing file to None", () =>
  Effect.gen(function* () {
    const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({
      prefix: "items-",
    });
    yield* Effect.gen(function* () {
      const files = yield* ItemFiles;
      yield* files.write("a", "lamp");
      assert.deepStrictEqual(yield* files.read("a"), Option.some("lamp"));
      assert.deepStrictEqual(yield* files.read("z"), Option.none());
    }).pipe(Effect.provide(itemFilesLayer({ root })));
  }).pipe(Effect.provide(NodeServices.layer)),
);
```

**Gotchas**

- `error.reason` is a `BadArgument` or a `SystemError` tagged `NotFound`, `PermissionDenied`, and others. Narrow with `Effect.catchReason`.
- `makeTempDirectoryScoped` deletes the directory when the `Scope` closes. `it.effect` supplies the scope.

## Child processes

**Use** `ChildProcess.make(cmd, args, options)` from `effect/process` with `ChildProcessSpawner`. **Not** `node:child_process`.
**Why:** interruption kills the process, and output is a typed `Stream`.
`spawner.string`, `lines`, and `exitCode` run a command. `spawner.spawn` returns a scoped handle: `stdout`, `stderr`, `stdin`, `exitCode`, `kill`. `ChildProcess.pipeTo` chains commands.

```ts
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer, type PlatformError, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

class CommandFailed extends Schema.TaggedError<CommandFailed>()("CommandFailed", {
  exitCode: Schema.Int,
  stderr: Schema.String,
}) {}
class Shell extends Context.Service<
  Shell,
  {
    run(
      command: string,
      args: ReadonlyArray<string>,
    ): Effect.Effect<string, CommandFailed | PlatformError.PlatformError>;
  }
>()("@app/process/Shell") {}
const shellLayer = Layer.effect(
  Shell,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const run = Effect.fn("Shell.run")(function* (command: string, args: ReadonlyArray<string>) {
      const handle = yield* spawner.spawn(ChildProcess.make(command, args));
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
          handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: "unbounded" },
      );
      if (exitCode !== 0) return yield* new CommandFailed({ exitCode, stderr });
      return stdout;
    }, Effect.scoped);
    return Shell.of({ run });
  }),
);
it.effect("returns stdout and fails on a non-zero exit", () =>
  Effect.gen(function* () {
    const shell = yield* Shell;
    assert.strictEqual(yield* shell.run("sh", ["-c", "printf ok"]), "ok");
    const failed = yield* shell.run("sh", ["-c", "echo bad >&2; exit 3"]).pipe(Effect.flip);
    assert.deepStrictEqual(failed, new CommandFailed({ exitCode: 3, stderr: "bad\n" }));
  }).pipe(Effect.provide(shellLayer.pipe(Layer.provide(NodeServices.layer)))),
);
```

**Gotchas**

- `string`, `lines`, and the output streams ignore the exit code. A failed command returns its partial stdout.
- Read stdout, stderr, and `exitCode` concurrently. An unread full pipe blocks the child.
- Interrupt sends `SIGTERM` to the process group. `forceKillAfter` escalates to `SIGKILL`.
- `env` without `extendEnv: true` replaces the whole environment, `PATH` included.

## CLI

**Use** `effect/cli` for any program with flags or subcommands. **Not** for a zero-argument script — hand it to `runMain`.
**Why:** flags decode through Schema, and help, `--version`, and parse errors come free.
Flags: `Flag.String`, `Flag.Int`, `Flag.Boolean`, `Flag.Literals`, `Flag.Redacted`, chained with `Flag.withAlias`, `Flag.optional`, `Flag.withDefault`.
`Argument.String(name)` is positional. A subcommand reads `Command.withSharedFlags` values with `yield* parent`.
Print user output with `Console.log`, so `TestConsole` captures it. Diagnostics stay on `Effect.log*`.
Parse errors fail with `CliError.ShowHelp`. The real reason sits in `error.errors`.

```ts
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Console, Effect, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { TestConsole } from "effect/testing";

const items = Command.make("items").pipe(
  Command.withSharedFlags({ dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)) }),
);
const add = Command.make(
  "add",
  {
    name: Argument.String("name").pipe(Argument.withSchema(Schema.NonEmptyString)),
    quantity: Flag.Int("quantity").pipe(Flag.withAlias("q")),
  },
  Effect.fn("ItemsCli.add")(function* ({ name, quantity }) {
    const { dryRun } = yield* items;
    yield* Console.log(`${dryRun ? "would add" : "added"} ${quantity} x ${name}`);
  }),
);
const runItemsCli = Command.runWith(items.pipe(Command.withSubcommands([add])), {
  version: "1.0.0",
});
it.effect("parses flags and reports bad input as ShowHelp", () =>
  Effect.gen(function* () {
    yield* runItemsCli(["--dry-run", "add", "lamp", "-q", "2"]);
    assert.deepStrictEqual(yield* TestConsole.logLines, ["would add 2 x lamp"]);
    const error = yield* runItemsCli(["add", "lamp", "--quantity", "many"]).pipe(Effect.flip);
    assert.isTrue(error._tag === "ShowHelp" && error.errors[0]?._tag === "InvalidValue");
  }).pipe(Effect.provide(NodeServices.layer)),
);
```

**Gotcha:** `Flag.Boolean` is required. An absent `--dry-run` fails with `MissingOption` unless it has `Flag.withDefault(false)`.

## Entry point

**Use** `NodeRuntime.runMain` as the last line of a Node process. **Not** `Effect.runPromise` — it skips signals and exit codes.
**Why:** `SIGINT` and `SIGTERM` interrupt the main fiber, so every finalizer and layer release runs.

- A CLI: `cli.pipe(Command.run({ version: "1.0.0" }), Effect.provide(NodeServices.layer), NodeRuntime.runMain)`. `Command.run` reads argv from `Stdio`.
- A server: `Layer.launch(appLayer).pipe(NodeRuntime.runMain)`. Read [services](services.md) for `ManagedRuntime`.
- Exit code is 0 on success, 130 on interrupt, 1 on failure, or the error's `[Runtime.errorExitCode]`. Bad CLI input exits 1.
- `runMain` logs the failure `Cause` unless `{ disableErrorReporting: true }`. `{ teardown }` replaces the exit-code logic.

## Encoding

| Module                | Use when                             | Shape                                                                                          |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Base64`, `Base64Url` | Bytes inside JSON, headers, or URLs  | `encode(bytes)`. `decode(text)` returns a `Result`                                             |
| `Hex`                 | Digests and byte dumps               | `Hex.encode(bytes)`. `Hex.decode(text)` returns a `Result`                                     |
| `Yaml`                | A YAML config file                   | `Yaml.parse(text)` returns `unknown` and throws. Wrap in `Effect.try`, then decode with Schema |
| `Toml`                | A TOML config file                   | `Toml.parse(text)` returns a record and throws. Wrap in `Effect.try`, then decode with Schema  |
| `Ndjson`              | Line-delimited JSON on a text stream | `Stream.pipeThroughChannel(Ndjson.decodeSchemaString(Item)())`                                 |
| `Sse`                 | Server-sent events with JSON `data`  | `Stream.pipeThroughChannel(Sse.decodeDataSchema(Item))` emits `{ event, id, data }`            |

## Fail review on

```ts
const text = fs.readFileSync(path, "utf8");
vi.mock("node:fs");
Effect.provide(FileSystem.layerNoop({ readFileString: () => Effect.succeed("{}") }));
```

Write `yield* fileSystem.readFileString(path)`. Test it against real files in `makeTempDirectoryScoped()`.

## Upstream

`node_modules/effect/ai-docs/src/60_child-process/10_working-with-child-processes.ts`, `node_modules/effect/ai-docs/src/70_cli/10_basics.ts`, `node_modules/effect/ai-docs/src/01_effect/06_running/10_run-main.ts`
