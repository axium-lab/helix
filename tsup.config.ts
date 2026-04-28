import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false,
    outDir: "dist/esm",
    clean: false,
    splitting: false,
    target: "es2022",
    external: ["openai"],
  },
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: false,
    outDir: "dist/cjs",
    clean: false,
    splitting: false,
    target: "es2022",
    external: ["openai"],
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: { only: true },
    outDir: "dist/types",
    clean: false,
    splitting: false,
    target: "es2022",
    external: ["openai"],
  },
]);
