import { describe, expect, it } from "vitest";
import { brokerCap } from "../src/index.js";

const DATE = "2026-10-18";
const eur = (amount: number) => Math.round(amount * 100);

describe("brokerCap (§ 15 Abs. 2, § 12 Abs. 2 and 4 Makler regulation)", () => {
  it.each([
    // value, cap, basis
    [30_000, 1_200, "lowerBracket"],
    [36_336.42, 1_453.46, "lowerBracket"],
    [36_336.43, 1_453.46, "lowerBracketFloor"],
    [40_000, 1_453.46, "lowerBracketFloor"],
    [48_448.51, 1_453.46, "lowerBracketFloor"],
    // 3% of 48,448.56 equals 4% of 36,336.42 exactly (1,453.4568)
    [48_448.56, 1_453.46, "upperBracket"],
    [48_448.57, 1_453.46, "upperBracket"],
    [50_000, 1_500, "upperBracket"],
    [250_000, 7_500, "upperBracket"],
  ] as const)("caps a €%d purchase at €%d (%s)", (value, cap, basis) => {
    const result = brokerCap(eur(value), DATE);
    expect(result.capCents).toBe(eur(cap));
    expect(result.basis).toBe(basis);
  });

  it("doubles the cap when the other side pays nothing", () => {
    expect(brokerCap(eur(250_000), DATE).oneSidedCapCents).toBe(eur(15_000));
    expect(brokerCap(eur(40_000), DATE).oneSidedCapCents).toBe(eur(2_906.91));
  });

  it("cites the floor rule only when it applies", () => {
    const legal = (value: number) => brokerCap(eur(value), DATE).citations.map((c) => c.legalBasis).join();
    expect(legal(40_000)).toMatch(/§ 12 Abs\. 4/);
    expect(legal(250_000)).not.toMatch(/§ 12 Abs\. 4/);
  });
});
