import { defineConfig } from "vitest/config";

// These tests only cover pure, dependency-free logic (date math, Jalali
// conversion, small game/parsing helpers), so plain Node is enough — no
// Cloudflare Workers runtime bindings are needed here.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
