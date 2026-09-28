import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as pl from "../src/index";

beforeEach(() => {
  pl.resetRegistry();
  pl.resetBuffer();
  pl.configure({ output: "buffer" });
});

afterEach(() => {
  pl.resetRegistry();
  pl.resetBuffer();
  pl.configure({ output: "console" });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("track", () => {
  it("silent when the promise settles in time", async () => {
    const p = pl.track("fast", Promise.resolve(1));
    await p;
    expect(pl.bufferWarnings()).toHaveLength(0);
  });

  it("passes through the value and does not swallow rejections", async () => {
    const v = await pl.track("value", Promise.resolve(42));
    expect(v).toBe(42);
    await expect(
      pl.track("rejecting", Promise.reject(new Error("skip"))),
    ).rejects.toThrow("skip");
  });

  it("warns once pending time passes warnAfter with where it hangs", async () => {
    let t = 0;
    pl.configure({ now: () => t, warnAfter: 100, repeatAfter: 0 });

    const gate = deferred<number>();
    const tracked = pl.track("confirm-payment", gate.promise);
    t += 101;
    // real timer: warnAfter=100ms -> fires in ~=100ms; wait 300ms
    await new Promise((r) => setTimeout(r, 300));
    const warned = pl.bufferWarnings();
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain("Promise still pending after 100ms");
    expect(warned[0]).toContain("confirm-payment");

    gate.resolve(1);
    await tracked;
    expect(pl.registry(true)).toHaveLength(0);
  });

  it("cleans up once resolved before emitting", async () => {
    pl.configure({ warnAfter: 50, repeatAfter: 0 });
    const tracked = pl.track("quick", new Promise<number>((r) => setTimeout(r, 10, 1)));
    await tracked;
    // pending entry removed after settle
    expect(pl.registry(true)).toHaveLength(0);
  });
});

describe("trackGroup", () => {
  it("returns Promise.all values", async () => {
    const out = await pl.trackGroup("checkout", [Promise.resolve(1), Promise.resolve(2)]);
    expect(out).toEqual([1, 2]);
    expect(pl.bufferWarnings()).toHaveLength(0);
  });
});

describe("registry", () => {
  it("keeps settled entries out of pendingOnly mode", async () => {
    pl.track("later", Promise.resolve("done"));
    await Promise.resolve();
    expect(pl.registry(true)).toHaveLength(0);
    expect(pl.registry(false).length).toBeGreaterThan(0);
  });
});
