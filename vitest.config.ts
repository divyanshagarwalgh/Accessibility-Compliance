import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // webflow-components is an independent package with its own test run.
    // Without this exclude the root suite runs it a second time.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "webflow-components/**", "scan-worker/**", ".next/**", ".open-next/**"],
  },
});
