import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { annuityPayment, annuitySchedule } from "../src/index.js";

/**
 * Textbook float formula, only for comparison within a cent. Uses expm1/log1p for 1 − (1+r)^−n:
 * the naive form cancels catastrophically at tiny rates (3 ppm, 96 months is off by ~5e-4 cents).
 */
function floatPayment(loanCents: number, ratePpm: number, months: number): number {
  const r = ratePpm / 12_000_000;
  return r === 0 ? loanCents / months : (loanCents * r) / -Math.expm1(-months * Math.log1p(r));
}

describe("annuityPayment", () => {
  it("matches the textbook formula within half a cent", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100_000, max: 500_000_000 }),
        fc.integer({ min: 0, max: 150_000 }),
        fc.integer({ min: 1, max: 50 }),
        (loan, ppm, years) => {
          const exact = annuityPayment(loan, ppm, years * 12);
          expect(Math.abs(exact - floatPayment(loan, ppm, years * 12))).toBeLessThanOrEqual(0.5 + 1e-6);
        },
      ),
    );
  });

  it("rounds a tiny-rate case from the exact value (3 ppm over 8 years)", () => {
    // exact payment 3,760,374.5004 cents; the naive float formula gives 3,760,374.4999
    expect(annuityPayment(360_991_575, 3, 96)).toBe(3_760_375);
  });

  it("divides the loan evenly at 0%", () => {
    expect(annuityPayment(10_000_000, 0, 120)).toBe(83_333);
  });

  it("returns 0 for no loan", () => {
    expect(annuityPayment(0, 39_000, 300)).toBe(0);
  });

  it("computes a known case: €174,850 at 3.9% over 25 years", () => {
    expect(annuityPayment(17_485_000, 39_000, 300)).toBe(91_330);
  });
});

describe("annuitySchedule", () => {
  it("repays the loan exactly and splits year 1 consistently", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100_000, max: 200_000_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 1, max: 40 }),
        (loan, ppm, years) => {
          const s = annuitySchedule(loan, ppm, years * 12);
          expect(s.year1PrincipalCents + s.balanceAfterYear1Cents).toBe(loan);
          if (years > 1) expect(s.year1InterestCents + s.year1PrincipalCents).toBe(12 * s.monthlyPaymentCents);
          // The last payment absorbs rounding: the ≤ 0.5 ct payment error compounds over
          // the term, plus up to 0.5 ct of interest rounding per month.
          const n = years * 12;
          const r = ppm / 12_000_000;
          const compounded = r === 0 ? n : ((1 + r) ** n - 1) / r;
          const totalPaid = loan + s.totalInterestCents;
          expect(Math.abs(totalPaid - s.monthlyPaymentCents * n)).toBeLessThanOrEqual(0.5 * compounded + n);
          expect(s.totalInterestCents).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it("has no interest at 0%", () => {
    const s = annuitySchedule(10_000_000, 0, 120);
    expect(s.totalInterestCents).toBe(0);
    expect(s.year1PrincipalCents).toBe(12 * 83_333);
  });

  it("rejects a term under one month", () => {
    expect(() => annuitySchedule(100_000, 30_000, 0)).toThrow(RangeError);
  });
});
