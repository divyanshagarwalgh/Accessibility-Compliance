/**
 * Making bundled vendor source safe to evaluate inside the page.
 *
 * ## The problem
 *
 * Wrangler bundles this worker with esbuild and `keepNames` enabled. There is
 * no configuration option to disable it — not in `wrangler.json`, not on
 * `wrangler deploy` (checked against wrangler 4.119.0).
 *
 * `keepNames` preserves `Function.prototype.name` through minification by
 * emitting a helper and a call beside every named function:
 *
 * ```js
 * var __name = (target, value) => Object.defineProperty(target, "name", { value, configurable: true });
 * function _typeof(o) { ... }
 * __name(_typeof, "_typeof");
 * ```
 *
 * That is harmless for code that stays in the worker, because `__name` is
 * declared at the top of the same bundle. It is not harmless for axe-core.
 * axe-core's own dist is itself an esbuild build, so when our bundler re-prints
 * it, the `axe.source` string — the entire library, which we inject into the
 * scanned page — comes out carrying 1,815 calls to `__name` and no declaration
 * of it. `__name` lives in the *worker's* module scope; the browser has never
 * heard of it.
 *
 * The result was that every scan died on the first statement axe executed:
 *
 * ```
 * ReferenceError: __name is not defined
 *     at axeFunction (evaluate at runScan (index.js:57338:16), <anonymous>:12:6)
 * ```
 *
 * ## The fix
 *
 * Ship esbuild's helper alongside the code that expects it. `__name` is the
 * only free identifier the transformed source leaves undefined — every other
 * `__`-prefixed name in it is either a `/* @__PURE__ *\/` annotation, a real
 * JavaScript property (`__proto__`, `__esModule`, `__defineGetter__`), or one
 * of axe's own properties, and all of esbuild's other helpers are declared
 * inside the string already.
 *
 * The definition below is esbuild's, unchanged. A no-op `(fn) => fn` would stop
 * the crash but throw away every function name, which is the one thing the
 * helper exists to protect and which axe reads back off its rule functions.
 *
 * ## Why not fix it in the bundler
 *
 * Two alternatives were considered and rejected. Bundling the worker by hand
 * with `keepNames: false` means reimplementing Wrangler's resolution of
 * `nodejs_compat`, `cloudflare:*` and the workerd export conditions, which is a
 * lot of surface to own for one flag. Importing `axe-core/axe.min.js` through a
 * `Text` module rule avoids the transform entirely, but reaches past the
 * package's public API into a file path it does not promise to keep. Prepending
 * 130 bytes is the smaller commitment, and `inject.test.ts` pins the behaviour.
 */

/**
 * esbuild's `keepNames` helper, verbatim, guarded so a page that already
 * defines `__name` keeps its own.
 */
export const ESBUILD_HELPER_PREAMBLE =
  'globalThis.__name = globalThis.__name || ' +
  'function (target, value) { ' +
  'return Object.defineProperty(target, "name", { value: value, configurable: true }); ' +
  "};\n";

/**
 * Prepares bundler-transformed source for `page.evaluate`.
 *
 * The payload is passed through untouched — only prefixed. Rewriting 1.3 MB of
 * vendor code to strip the helper calls would be a worse cure than the disease.
 */
export function injectable(source: string): string {
  return ESBUILD_HELPER_PREAMBLE + source;
}
