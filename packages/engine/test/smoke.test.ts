import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ENGINE_VERSION } from "../src/index.js";

describe("engine smoke test", () => {
  it("exposes a semver version", () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("runs property-based tests", () => {
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n));
  });
});
