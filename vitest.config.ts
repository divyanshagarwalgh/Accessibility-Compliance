import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path in tsconfig.json. Next.js resolves it for app
    // code; vitest needs telling separately, or any test that reaches across
    // src/ directories has to spell out "../../".
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // webflow-components is an independent package with its own test run.
    // Without this exclude the root suite runs it a second time.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "webflow-components/**", "scan-worker/**", ".next/**", ".open-next/**"],
  },
});
