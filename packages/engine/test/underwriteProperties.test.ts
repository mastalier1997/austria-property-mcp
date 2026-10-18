import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { underwrite, type UnderwriteInput } from "../src/index.js";

const euros = (min: number, max: number) => fc.integer({ min: min * 100, max: max * 100 }).map((c) => c / 100);
const pct = (max: number) => fc.integer({ min: 0, max: max * 100 }).map((n) => n / 100);

const input = fc
  .record({
    priceCents: fc.integer({ min: 5_000_000, max: 200_000_000 }),
    loanShare: fc.integer({ min: 0, max: 100 }),
    ratePct: pct(8),
    termYears: fc.integer({ min: 5, max: 40 }),
    area: fc.integer({ min: 2_000, max: 20_000 }).map((h) => h / 100),
    rent: euros(300, 5_000),
    operatingCosts: euros(0, 600),
    reserve: fc.option(euros(0, 300), { nil: undefined }),
    vacancyPct: pct(10),
    managementPct: pct(10),
  })
  .map(
    (r): UnderwriteInput => ({
      valuationDate: "2026-10-18",
      purchasePrice: r.priceCents / 100,
      broker: "none",
      ...(r.loanShare > 0
        ? { financing: { loanAmount: Math.floor(r.priceCents * r.loanShare / 100) / 100, ratePct: r.ratePct, termYears: r.termYears } }
        : {}),
      property: { livingAreaM2: r.area, ownership: "condominium", buildingPermitDate: "1990-01-01" },
      rent: { netColdMonthly: r.rent, operatingCostsMonthly: r.operatingCosts },
      ...(r.reserve === undefined ? {} : { ownerCosts: { reserveFundMonthly: r.reserve } }),
      assumptions: { vacancyPct: r.vacancyPct, managementPct: r.managementPct },
    }),
  );

const withRent = (i: UnderwriteInput, rentCents: number): UnderwriteInput => ({
  ...i,
  rent: { ...i.rent, netColdMonthly: rentCents / 100 },
});

describe("underwrite properties", () => {
  it("NOI and cash flow add up from the operating lines and the loan payment", () => {
    fc.assert(
      fc.property(input, (i) => {
        const r = underwrite(i);
        const signed = r.operating.reduce((s, l) => s + (l.kind === "income" ? l.amountCents : -l.amountCents), 0);
        expect(r.metrics.monthlyNoiCents).toBe(signed);
        expect(r.metrics.monthlyCashFlowCents).toBe(signed - (r.financing?.monthlyPaymentCents ?? 0));
        for (const l of r.operating) expect(Number.isSafeInteger(l.amountCents) && l.amountCents >= 0).toBe(true);
      }),
    );
  });

  it("cash flow never falls when the rent rises", () => {
    fc.assert(
      fc.property(input, fc.integer({ min: 1, max: 50_000 }), (i, extra) => {
        const rent = Math.round(i.rent.netColdMonthly * 100);
        expect(underwrite(withRent(i, rent + extra)).metrics.monthlyCashFlowCents).toBeGreaterThanOrEqual(
          underwrite(i).metrics.monthlyCashFlowCents,
        );
      }),
    );
  });

  it("cash flow never rises when the interest rate rises", () => {
    fc.assert(
      fc.property(input, fc.integer({ min: 1, max: 300 }), (i, bp) => {
        if (!i.financing) return;
        const higher = { ...i, financing: { ...i.financing, ratePct: Math.round(i.financing.ratePct * 100 + bp) / 100 } };
        expect(underwrite(higher).metrics.monthlyCashFlowCents).toBeLessThanOrEqual(underwrite(i).metrics.monthlyCashFlowCents);
      }),
    );
  });

  it("the break-even rent brings cash flow to zero, within rounding", () => {
    fc.assert(
      fc.property(input, (i) => {
        const be = underwrite(i).metrics.breakEvenRentCents;
        if (be === null || be < 1) return;
        expect(underwrite(withRent(i, be)).metrics.monthlyCashFlowCents).toBeGreaterThanOrEqual(-1);
        if (be > 1) expect(underwrite(withRent(i, be - 1)).metrics.monthlyCashFlowCents).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("yields and DSCR agree in sign with NOI", () => {
    fc.assert(
      fc.property(input, (i) => {
        const m = underwrite(i).metrics;
        expect(Math.sign(m.netYieldPct) * Math.sign(m.monthlyNoiCents)).toBeGreaterThanOrEqual(0);
        if (m.dscr !== null) expect(Math.sign(m.dscr) * Math.sign(m.monthlyNoiCents)).toBeGreaterThanOrEqual(0);
        expect(m.grossYieldPct).toBeGreaterThan(0);
      }),
    );
  });
});
