// The parts of vite.config.ts this skill sets. Merge into the scaffolded file.
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Libraries only: generate .d.ts with oxc instead of the TypeScript 7
  // compiler. Exported functions need explicit return types, or the build
  // fails with TS9007.
  pack: {
    dts: {
      generator: "oxc",
    },
  },
  // Type checking is tsrs (`vp run typecheck`). Both options would run the
  // TypeScript 7 toolchain instead.
  lint: {
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {},
});
