import { describe, expect, it } from "vitest";
import { createContext, runInContext } from "node:vm";
import { ESBUILD_HELPER_PREAMBLE, injectable } from "./inject";

/**
 * Regression cover for the bug that stopped every scan from completing.
 *
 * Wrangler bundles the worker with esbuild and `keepNames` enabled, and offers
 * no way to turn that off. esbuild therefore re-prints axe-core rather than
 * passing it through, wrapping every named function with its own `__name`
 * helper. `axe.source` — the string we inject into the page — comes out of that
 * bundle carrying 1,800+ calls to a helper that exists only in the worker's
 * module scope. Injecting it raw threw `ReferenceError: __name is not defined`
 * inside axe's own IIFE, on the very first statement it ran.
 *
 * A plain `import` of axe-core in a test resolves the *untransformed* package,
 * so asserting against the real `axe.source` here would pass with or without
 * the fix and prove nothing. These tests use a hand-written sample shaped
 * exactly like esbuild's output instead, and run it in a bare VM context —
 * which is the closest thing to a fresh browser global that Node offers.
 */

/** Exactly what esbuild emits for a named function declaration under keepNames. */
const ESBUILD_SHAPED_SOURCE = `(function axeFunction(window2) {
  function _typeof(o) { return typeof o; }
  __name(_typeof, "_typeof");
  window2.axe = { ran: true, typeofName: _typeof.name };
})(globalThis);`;

describe("injectable", () => {
  it("reproduces the crash when the helper is absent", () => {
    // Guards the premise: without the preamble this genuinely throws, so a
    // green result below cannot be a false positive.
    expect(() => runInContext(ESBUILD_SHAPED_SOURCE, createContext({}))).toThrow(
      /__name is not defined/,
    );
  });

  it("evaluates esbuild-transformed source in a bare global scope", () => {
    const context = createContext({});
    runInContext(injectable(ESBUILD_SHAPED_SOURCE), context);
    expect((context as { axe?: { ran?: boolean } }).axe?.ran).toBe(true);
  });

  it("preserves the function names esbuild's helper exists to keep", () => {
    // A no-op shim would satisfy the test above while silently discarding
    // `fn.name`. axe reads rule function names, so the shim has to be faithful.
    const context = createContext({});
    runInContext(injectable(ESBUILD_SHAPED_SOURCE), context);
    expect((context as { axe?: { typeofName?: string } }).axe?.typeofName).toBe("_typeof");
  });

  it("does not clobber a helper the page already defines", () => {
    const context = createContext({});
    runInContext(`globalThis.__name = (t) => t; globalThis.__seen = __name;`, context);
    runInContext(injectable(ESBUILD_SHAPED_SOURCE), context);
    const ctx = context as { __name?: unknown; __seen?: unknown };
    expect(ctx.__name).toBe(ctx.__seen);
  });

  it("leaves the payload itself byte-for-byte intact", () => {
    // The preamble is prepended, never interpolated into the source — rewriting
    // 1.3 MB of vendor code would be a far worse cure than the disease.
    expect(injectable("PAYLOAD").endsWith("PAYLOAD")).toBe(true);
    expect(injectable("PAYLOAD").startsWith(ESBUILD_HELPER_PREAMBLE)).toBe(true);
  });
});
