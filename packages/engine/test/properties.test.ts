import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { acquisitionCosts, type AcquisitionCostsInput } from "../src/index.js";

const dates = fc.constantFrom("2025-04-01", "2026-07-31", "2026-08-01", "2026-10-18");
/** Prices from €1,000 to €20,000,000, in cents. */
const priceCents = fc.integer({ min: 100_000, max: 2_000_000_000 });
/** Percentages with two decimals, e.g. 3.57. */
const pct = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((n) => n / 100);

const input = fc
  .record({
    valuationDate: dates,
    priceCents,
    broker: fc.option(
      fc.record({
        commissionPct: pct(6),
        sellerPaysCommission: fc.option(fc.boolean(), { nil: undefined }),
      }),
      { nil: undefined },
    ),
    loanShare: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    contractFeePct: pct(3),
    grundbuchFiling: fc.constantFrom("electronic" as const, "paper" as const),
    grundbuchApplications: fc.integer({ min: 1, max: 3 }),
  })
  .map(
    (r): AcquisitionCostsInput => ({
      valuationDate: r.valuationDate,
      purchasePrice: r.priceCents / 100,
      broker: r.broker ?? "none",
      ...(r.loanShare === undefined
        ? {}
        : { financing: { loanAmount: Math.floor((r.priceCents * r.loanShare) / 100) / 100 } }),
      assumptions: {
        contractFeePct: r.contractFeePct,
        grundbuchFiling: r.grundbuchFiling,
        grundbuchApplications: r.grundbuchApplications,
      },
    }),
  );

const amount = (input: AcquisitionCostsInput, id: string) =>
  acquisitionCosts(input).lineItems.find((l) => l.id === id)?.amountCents ?? 0;

describe("acquisitionCosts properties", () => {
  it("produces whole, non-negative cents that sum to the total", () => {
    fc.assert(
      fc.property(input, (i) => {
        const result = acquisitionCosts(i);
        for (const line of result.lineItems) {
          expect(Number.isSafeInteger(line.amountCents)).toBe(true);
          expect(line.amountCents).toBeGreaterThanOrEqual(0);
        }
        expect(result.lineItems.reduce((s, l) => s + l.amountCents, 0)).toBe(result.totalCents);
        expect(Number.isFinite(result.totalPctOfPrice)).toBe(true);
      }),
    );
  });

  it("never lowers total costs when the price rises", () => {
    fc.assert(
      fc.property(input, fc.integer({ min: 1, max: 10_000_000 }), (i, extraCents) => {
        const higher = { ...i, purchasePrice: Math.round(i.purchasePrice * 100 + extraCents) / 100 };
        expect(acquisitionCosts(higher).totalCents).toBeGreaterThanOrEqual(acquisitionCosts(i).totalCents);
      }),
    );
  });

  it("rounds Grunderwerbsteuer to within half a cent of 3.5%", () => {
    fc.assert(
      fc.property(input, (i) => {
        const exact = i.purchasePrice * 100 * 0.035;
        expect(Math.abs(amount(i, "grest") - exact)).toBeLessThanOrEqual(0.5 + 1e-6);
      }),
    );
  });

  it("never undercharges court fees: rounding only goes up", () => {
    fc.assert(
      fc.property(input, (i) => {
        const paper = { ...i, assumptions: { ...i.assumptions, grundbuchFiling: "paper" as const } };
        const fee = amount(paper, "grundbuch.eigentum");
        const exact = i.purchasePrice * 100 * 0.011;
        expect(fee).toBeGreaterThanOrEqual(exact - 1e-6);
        expect(fee - exact).toBeLessThan(100 + 1.1 + 1e-6); // at most one euro on the fee plus one on the base
        expect(fee % 100).toBe(0);
      }),
    );
  });

  it("flags every commission above the one-sided cap", () => {
    fc.assert(
      fc.property(input, (i) => {
        const result = acquisitionCosts(i);
        const ids = result.flags.map((f) => f.id);
        expect(ids.includes("broker.aboveCap") && ids.includes("broker.lawfulOnlyIfSellerPaysNothing")).toBe(false);
        if (i.broker !== "none" && i.broker.commissionPct > 6) expect(ids).toContain("broker.aboveCap");
      }),
    );
  });
});
