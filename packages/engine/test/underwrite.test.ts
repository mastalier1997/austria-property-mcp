import { describe, expect, it } from "vitest";
import { InputError, RuleNotCoveredError, underwrite, type UnderwriteInput } from "../src/index.js";

const BASE: UnderwriteInput = {
  valuationDate: "2026-10-18",
  purchasePrice: 250_000,
  broker: { commissionPct: 3, sellerPaysCommission: true },
  financing: { loanAmount: 160_000, ratePct: 3.8, termYears: 25 },
  property: { livingAreaM2: 60, ownership: "condominium", buildingPermitDate: "1990-01-01" },
  rent: { netColdMonthly: 1_000, operatingCostsMonthly: 180 },
};

const line = (input: UnderwriteInput, id: string) => underwrite(input).operating.find((l) => l.id === id);

describe("underwrite", () => {
  it("is deterministic", () => {
    expect(underwrite(BASE)).toEqual(underwrite(structuredClone(BASE)));
  });

  it("includes the acquisition costs and their flags", () => {
    const result = underwrite(BASE);
    expect(result.acquisition.lineItems.length).toBeGreaterThan(0);
    for (const flag of result.acquisition.flags) expect(result.flags).toContainEqual(flag);
    expect(result.metrics.totalInvestmentCents).toBe(25_000_000 + result.acquisition.totalCents);
  });

  it("orders flags by severity", () => {
    const rank = { high: 0, warn: 1, info: 2 } as const;
    const severities = underwrite({ ...BASE, property: { ownership: "condominium", buildingPermitDate: "1900-01-01" } }).flags.map(
      (f) => rank[f.severity],
    );
    expect(severities).toEqual([...severities].sort((a, b) => a - b));
  });

  it("switches the statutory minimum reserve on 1 January 2026", () => {
    const reserve = (valuationDate: string) =>
      line({ ...BASE, valuationDate, ownerCosts: {} }, "reserveFund")?.amountCents;
    expect(reserve("2025-12-31")).toBe(106 * 60);
    expect(reserve("2026-01-01")).toBe(112 * 60);
  });

  it("needs a verified reserve amount from 2028 unless the reserve is given", () => {
    expect(() => underwrite({ ...BASE, valuationDate: "2028-01-01" })).toThrow(RuleNotCoveredError);
    expect(() => underwrite({ ...BASE, valuationDate: "2028-01-01", ownerCosts: { reserveFundMonthly: 70 } })).not.toThrow();
  });

  it("assumes a condominium for the reserve when ownership is unknown, and says so", () => {
    const result = underwrite({ ...BASE, property: { livingAreaM2: 60 } });
    expect(result.operating.find((l) => l.id === "reserveFund")?.amountCents).toBe(6_720);
    expect(result.flags.find((f) => f.id === "assumption.reserveMinimum")?.message).toMatch(/assuming a condominium/);
  });

  it("flags a missing reserve when there is no floor area", () => {
    const result = underwrite({ ...BASE, property: { ownership: "condominium", buildingPermitDate: "1990-01-01" } });
    expect(result.operating.some((l) => l.id === "reserveFund")).toBe(false);
    expect(result.flags.find((f) => f.id === "inputs.reserveUnknown")?.severity).toBe("high");
    expect(result.metrics.breakEvenRentPerM2).toBeNull();
  });

  it("charges no WEG reserve for a house", () => {
    const result = underwrite({ ...BASE, property: { livingAreaM2: 120, ownership: "house" } });
    expect(result.operating.some((l) => l.id === "reserveFund")).toBe(false);
    expect(result.flags.map((f) => f.id)).not.toContain("inputs.reserveUnknown");
  });

  it("charges vacancy on rent plus operating costs", () => {
    expect(line(BASE, "vacancy")?.amountCents).toBe(Math.round(0.04 * 118_000));
  });

  it("leaves loan metrics empty for a cash purchase", () => {
    const { financing: _ignored, ...cash } = BASE;
    const result = underwrite(cash);
    expect(result.financing).toBeNull();
    expect(result.metrics.dscr).toBeNull();
    expect(result.metrics.equityCents).toBe(result.metrics.totalInvestmentCents);
    expect(result.metrics.monthlyCashFlowCents).toBe(result.metrics.monthlyNoiCents);
  });

  it("returns a null break-even rent when vacancy and management take everything", () => {
    expect(() =>
      underwrite({ ...BASE, assumptions: { vacancyPct: 50, managementPct: 30 } }),
    ).not.toThrow();
    expect(() => underwrite({ ...BASE, assumptions: { vacancyPct: 50, managementPct: 50 } })).toThrow(InputError);
  });

  it("reports every input problem at once, including acquisition ones", () => {
    const bad = {
      valuationDate: "2026-10-18",
      purchasePrice: 0,
      broker: "none",
      financing: { loanAmount: 100_000, ratePct: 25, termYears: 0 },
      property: { ownership: "castle", livingAreaM2: -3, buildingYear: 1800.5 },
      rent: { netColdMonthly: 0 },
      assumptions: { vacancyPct: 120, unknownThing: 1 },
    } as unknown as UnderwriteInput;
    try {
      underwrite(bad);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InputError);
      expect((error as InputError).issues.map((i) => i.path).sort()).toEqual([
        "assumptions.unknownThing",
        "assumptions.vacancyPct",
        "financing.ratePct",
        "financing.termYears",
        "property.buildingYear",
        "property.livingAreaM2",
        "property.ownership",
        "purchasePrice",
        "rent.netColdMonthly",
      ]);
    }
  });

  it("requires rate and term when there is a loan", () => {
    const input = { ...BASE, financing: { loanAmount: 100_000 } } as unknown as UnderwriteInput;
    expect(() => underwrite(input)).toThrow(/financing\.ratePct.*financing\.termYears|financing\.termYears/);
  });
});
