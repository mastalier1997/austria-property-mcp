import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acquisitionCosts, type AcquisitionCostsInput } from "../src/index.js";

interface GoldenCase {
  name: string;
  description: string;
  input: AcquisitionCostsInput;
  expected: {
    lineItems: Record<string, number>;
    totalCents: number;
    totalPctOfPrice: number;
    flags: string[];
  };
}

const dir = join(import.meta.dirname, "../../../fixtures/golden/acquisition");
const cases: GoldenCase[] = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as GoldenCase);

describe("golden acquisition-cost cases", () => {
  it("has fixtures", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, golden) => {
    const result = acquisitionCosts(golden.input);
    const lineItems = Object.fromEntries(result.lineItems.map((item) => [item.id, item.amountCents]));
    expect(lineItems).toEqual(golden.expected.lineItems);
    expect(result.totalCents).toBe(golden.expected.totalCents);
    expect(result.totalPctOfPrice).toBe(golden.expected.totalPctOfPrice);
    expect(result.flags.map((f) => f.id).sort()).toEqual(golden.expected.flags);
  });
});
