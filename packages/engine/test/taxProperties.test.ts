import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { incomeTax, tariffFor, underwrite, type UnderwriteInput } from "../src/index.js";
import { RuleTracker } from "../src/calc/ruleTracker.js";

const euros = (min: number, max: number) => fc.integer({ min: min * 100, max: max * 100 }).map((c) => c / 100);
const pct = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((n) => n / 100);
const tariffs = ["2025-06-30", "2026-10-18", "2027-06-30"].map((d) => tariffFor(new RuleTracker(d)));

const input = fc
  .record({
    priceCents: fc.integer({ min: 5_000_000, max: 200_000_000 }),
    loanShare: fc.integer({ min: 0, max: 110 }),
    ratePct: pct(8),
    termYears: fc.integer({ min: 1, max: 40 }),
    rent: euros(300, 5_000),
    reserve: euros(0, 300),
    ownership: fc.constantFrom("condominium" as const, "house" as const, "wholeBuilding" as const),
    units: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
    otherIncome: fc.option(euros(0, 300_000), { nil: undefined }),
    landSharePct: fc.option(pct(100), { nil: undefined }),
    inhabitants: fc.option(fc.integer({ min: 0, max: 2_500_000 }), { nil: undefined }),
    marginalTaxRatePct: pct(55),
  })
  .map(
    (r): UnderwriteInput => ({
      valuationDate: "2026-10-18",
      purchasePrice: r.priceCents / 100,
      broker: "none",
      ...(r.loanShare > 0
        ? { financing: { loanAmount: Math.floor((r.priceCents * r.loanShare) / 100) / 100, ratePct: r.ratePct, termYears: r.termYears } }
        : {}),
      property: { livingAreaM2: 60, ownership: r.ownership, buildingPermitDate: "1990-01-01", ...(r.units === undefined ? {} : { unitsInBuilding: r.units }) },
      rent: { netColdMonthly: r.rent, operatingCostsMonthly: 150 },
      ownerCosts: { reserveFundMonthly: r.reserve },
      tax: {
        ...(r.otherIncome === undefined ? {} : { otherTaxableIncome: r.otherIncome }),
        ...(r.landSharePct === undefined ? {} : { landSharePct: r.landSharePct }),
        ...(r.inhabitants === undefined ? {} : { municipalityInhabitants: r.inhabitants }),
      },
      assumptions: { marginalTaxRatePct: r.marginalTaxRatePct },
    }),
  );

describe("income tax properties", () => {
  it("never falls as income rises, and the extra tax is at most 55% of the extra income", () => {
    fc.assert(
      fc.property(fc.constantFrom(...tariffs), fc.integer({ min: -1_000_000, max: 200_000_000 }), fc.integer({ min: 0, max: 50_000_000 }), (t, x, d) => {
        const extra = incomeTax(x + d, t) - incomeTax(x, t);
        expect(extra).toBeGreaterThanOrEqual(0);
        expect(extra).toBeLessThanOrEqual(Math.ceil(d * 0.55) + 1);
      }),
    );
  });
});

describe("tax properties", () => {
  it("each year's result, tax and after-tax cash flow add up", () => {
    fc.assert(
      fc.property(input, (i) => {
        const { tax } = underwrite(i);
        for (const y of tax.years) {
          expect(y.resultCents).toBe(y.netRentalIncomeCents - y.interestCents - y.afaCents - y.operatingCostsCents - y.loanCostsCents);
          expect(y.cashFlowAfterTaxCents).toBe(y.cashFlowBeforeTaxCents - y.taxCents);
          // Tax has the sign of the result and is at most 55% of it.
          if (y.resultCents >= 0) expect(y.taxCents).toBeGreaterThanOrEqual(0);
          if (y.resultCents <= 0) expect(y.taxCents).toBeLessThanOrEqual(0);
          expect(Math.abs(y.taxCents)).toBeLessThanOrEqual(Math.ceil(Math.abs(y.resultCents) * 0.55) + 1);
        }
        expect(tax.years.map((y) => y.year)).toEqual([1, 2, 3, 4, 5]);
      }),
    );
  });

  it("AfA steps down and never exceeds the building value; loan costs add up to the fee", () => {
    fc.assert(
      fc.property(input, (i) => {
        const { tax } = underwrite(i);
        const afa = tax.years.map((y) => y.afaCents);
        for (let k = 1; k < afa.length; k++) expect(afa[k]!).toBeLessThanOrEqual(afa[k - 1]!);
        expect(afa.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(tax.afa.buildingCents);
        expect(tax.afa.landShareCents + tax.afa.buildingCents).toBe(tax.afa.costBasisCents);
        if (tax.loanCosts) {
          const shown = tax.years.reduce((s, y) => s + y.loanCostsCents, 0);
          if (tax.loanCosts.spreadYears <= 5) expect(shown).toBe(tax.loanCosts.totalCents);
          else expect(shown).toBeLessThanOrEqual(tax.loanCosts.totalCents);
        }
      }),
    );
  });

  it("the Liebhaberei status agrees with the cumulative result", () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = underwrite(i);
        const l = r.tax.liebhaberei;
        if (l.status === "notChecked") {
          expect(i.property?.ownership).toBe("wholeBuilding");
          return;
        }
        const reserve = 12 * (r.operating.find((o) => o.id === "reserveFund")?.amountCents ?? 0);
        expect(l.resultByYearCents).toHaveLength(25);
        expect(l.resultByYearCents.slice(0, 5)).toEqual(r.tax.years.map((y) => y.resultCents - reserve));
        expect(l.cumulativeResultCents).toBe(l.resultByYearCents.reduce((a, b) => a + b, 0));
        expect(l.status === "totalSurplus").toBe(l.cumulativeResultCents! > 0);
        expect(l.totalSurplusFromYear !== null).toBe(l.status === "totalSurplus");
        if (l.totalSurplusFromYear !== null) {
          let cumulative = 0;
          l.resultByYearCents.forEach((v, k) => {
            cumulative += v;
            if (k + 1 >= l.totalSurplusFromYear!) expect(cumulative).toBeGreaterThan(0);
            if (k + 2 === l.totalSurplusFromYear) expect(cumulative).toBeLessThanOrEqual(0);
          });
        }
        expect(r.flags.some((f) => f.id === "tax.liebhabereiRisk")).toBe(l.status === "noTotalSurplus");
      }),
    );
  });

  it("a higher land share never raises the AfA", () => {
    fc.assert(
      fc.property(input, pct(100), pct(100), (i, a, b) => {
        const afa = (landSharePct: number) => underwrite({ ...i, tax: { ...i.tax, landSharePct } }).tax.years[0]!.afaCents;
        expect(afa(Math.max(a, b))).toBeLessThanOrEqual(afa(Math.min(a, b)));
      }),
    );
  });
});
