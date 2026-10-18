import { describe, expect, it } from "vitest";
import {
  bracketRate,
  incomeTax,
  InputError,
  landShare,
  RuleNotCoveredError,
  tariffFor,
  underwrite,
  type LandShareFacts,
  type UnderwriteInput,
} from "../src/index.js";
import { RuleTracker } from "../src/calc/ruleTracker.js";

const BASE: UnderwriteInput = {
  valuationDate: "2026-10-18",
  purchasePrice: 250_000,
  broker: { commissionPct: 3, sellerPaysCommission: true },
  financing: { loanAmount: 160_000, ratePct: 3.8, termYears: 25 },
  property: { livingAreaM2: 60, ownership: "condominium", buildingPermitDate: "1990-01-01" },
  rent: { netColdMonthly: 1_000, operatingCostsMonthly: 180 },
};

const tariff = (date: string) => tariffFor(new RuleTracker(date));
const share = (facts: LandShareFacts) => landShare(facts, new RuleTracker("2026-10-18"));
const flagIds = (input: UnderwriteInput) => underwrite(input).flags.map((f) => f.id);

describe("income tax tariff (§ 33 Abs. 1 EStG)", () => {
  // Hand-computed from the 2026 bracket limits.
  it.each([
    [0, 0],
    [1_353_900, 0],
    [2_199_200, 169_060],
    [3_645_800, 603_040],
    [7_036_500, 1_959_320],
    [10_485_900, 3_615_032],
    [100_000_000, 48_372_082],
    [100_010_000, 48_377_582],
  ])("taxes %s cents of income at %s cents in 2026", (income, tax) => {
    expect(incomeTax(income, tariff("2026-10-18"))).toBe(tax);
  });

  it("is zero for negative income", () => {
    expect(incomeTax(-500_000, tariff("2026-10-18"))).toBe(0);
  });

  it("rounds each bracket sum half up to the cent", () => {
    // 1 cent above the first limit: 20% of 1 cent = 0.2 cent → 0; 3 cents → 0.6 → 1.
    expect(incomeTax(1_353_901, tariff("2026-10-18"))).toBe(0);
    expect(incomeTax(1_353_903, tariff("2026-10-18"))).toBe(1);
  });

  it("switches bracket limits on 1 January", () => {
    expect(incomeTax(1_384_600, tariff("2026-12-31"))).toBe(6_140);
    expect(incomeTax(1_384_600, tariff("2027-01-01"))).toBe(0);
    expect(tariff("2025-12-31").limits[2]).toBe(3_583_600);
    expect(tariff("2026-01-01").limits[2]).toBe(3_645_800);
  });

  it("gives the rate for the next euro above an income", () => {
    const t = tariff("2026-10-18");
    expect(bracketRate(1_353_899, t)).toBe(0);
    expect(bracketRate(1_353_900, t)).toBe(200_000);
    expect(bracketRate(99_999_999, t)).toBe(500_000);
    expect(bracketRate(100_000_000, t)).toBe(550_000);
  });

  it("has no tariff for 2028 yet", () => {
    expect(() => tariff("2028-01-01")).toThrow(RuleNotCoveredError);
    expect(() => underwrite({ ...BASE, valuationDate: "2028-01-01", ownerCosts: { reserveFundMonthly: 70 }, tax: { otherTaxableIncome: 40_000 } })).toThrow(
      RuleNotCoveredError,
    );
    // The marginal-rate method needs no tariff.
    expect(underwrite({ ...BASE, valuationDate: "2028-01-01", ownerCosts: { reserveFundMonthly: 70 } }).tax.method).toBe("marginalRate");
  });
});

describe("land share (GrundanteilV 2016)", () => {
  it("is 20% only below both thresholds", () => {
    expect(share({ municipalityInhabitants: 99_999, landPriceCentsPerM2: 39_999 }).pct).toBe(20);
    expect(share({ municipalityInhabitants: 100_000, landPriceCentsPerM2: 39_999, unitsInBuilding: 4 }).pct).toBe(40);
    expect(share({ municipalityInhabitants: 99_999, landPriceCentsPerM2: 40_000, unitsInBuilding: 4 }).pct).toBe(40);
  });

  it("is 30% above 10 units and 40% up to 10 units elsewhere", () => {
    expect(share({ municipalityInhabitants: 2_000_000, unitsInBuilding: 10 }).pct).toBe(40);
    expect(share({ municipalityInhabitants: 2_000_000, unitsInBuilding: 11 }).pct).toBe(30);
  });

  it("assumes the higher share when facts are missing, and says so", () => {
    const unknown = share({});
    expect(unknown).toMatchObject({ pct: 40, basis: "grundanteilV", factsComplete: false });
    expect(unknown.explanation).toMatch(/municipalityInhabitants/);
    expect(unknown.explanation).toMatch(/unitsInBuilding/);
    // Small town but unknown land price: 20% is not shown.
    expect(share({ municipalityInhabitants: 5_000, unitsInBuilding: 6 })).toMatchObject({ pct: 40, factsComplete: false });
    // Large city, unit count unknown.
    expect(share({ municipalityInhabitants: 2_000_000 })).toMatchObject({ pct: 40, factsComplete: false });
    expect(share({ municipalityInhabitants: 2_000_000, unitsInBuilding: 6 })).toMatchObject({ pct: 40, factsComplete: true });
  });

  it("uses a given share as is", () => {
    expect(share({ inputPpm: 255_000, municipalityInhabitants: 5_000 })).toMatchObject({ pct: 25.5, basis: "input", factsComplete: true });
  });
});

describe("tax in underwrite", () => {
  it("defaults to a 40% marginal rate and a 40% land share, with info flags", () => {
    const r = underwrite(BASE);
    expect(r.tax.method).toBe("marginalRate");
    expect(r.tax.marginalRatePct).toBe(40);
    expect(r.tax.landShare.pct).toBe(40);
    expect(flagIds(BASE)).toEqual(expect.arrayContaining(["assumption.taxRate", "assumption.landShare"]));
    expect(r.assumptionsUsed.marginalTaxRatePct).toBe(40);
    expect(r.assumptionsDefaulted).toContain("marginalTaxRatePct");
  });

  it("drops the tax-rate flag when a rate or other income is given", () => {
    expect(flagIds({ ...BASE, assumptions: { marginalTaxRatePct: 30 } })).not.toContain("assumption.taxRate");
    expect(flagIds({ ...BASE, tax: { otherTaxableIncome: 50_000 } })).not.toContain("assumption.taxRate");
  });

  it("keeps the tax rate out of the operating-defaults flag", () => {
    const message = underwrite(BASE).flags.find((f) => f.id === "assumption.operatingDefaults")?.message;
    expect(message).not.toMatch(/tax/i);
  });

  it("applies the accelerated AfA: 4.5%, 3%, then 1.5%", () => {
    const { afa, years } = underwrite(BASE).tax;
    expect(years.map((y) => y.afaCents)).toEqual(
      [45_000n, 30_000n, 15_000n, 15_000n, 15_000n].map((ppm) => Number((BigInt(afa.buildingCents) * ppm * 2n + 1_000_000n) / 2_000_000n)),
    );
  });

  it("leaves the mortgage registration fee out of the AfA base", () => {
    const r = underwrite(BASE);
    const fee = r.acquisition.lineItems.find((l) => l.id === "grundbuch.pfandrecht")!.amountCents;
    expect(r.tax.afa.costBasisCents).toBe(r.metrics.totalInvestmentCents - fee);
    expect(r.tax.loanCosts?.totalCents).toBe(fee);
  });

  it("spreads the mortgage fee over the term, or deducts it at once for loans of up to two years", () => {
    const loanCosts = (termYears: number) => underwrite({ ...BASE, financing: { ...BASE.financing!, termYears } }).tax.loanCosts;
    expect(loanCosts(2)?.spreadYears).toBe(1);
    expect(loanCosts(3)?.spreadYears).toBe(3);
    const twoYear = underwrite({ ...BASE, financing: { ...BASE.financing!, termYears: 2 } }).tax.years;
    expect(twoYear[0]!.loanCostsCents).toBe(loanCosts(2)!.totalCents);
    expect(twoYear[1]!.loanCostsCents).toBe(0);
  });

  it("has no loan costs for a cash purchase", () => {
    const { financing: _, ...cash } = BASE;
    const r = underwrite(cash);
    expect(r.tax.loanCosts).toBeNull();
    expect(r.tax.years.every((y) => y.interestCents === 0 && y.loanCostsCents === 0)).toBe(true);
  });

  it("taxes with the tariff when other income is given", () => {
    const r = underwrite({ ...BASE, tax: { otherTaxableIncome: 50_000 } });
    const t = tariff("2026-10-18");
    expect(r.tax).toMatchObject({ method: "tariff", tariffYear: 2026, marginalRatePct: 40, otherTaxableIncomeCents: 5_000_000 });
    for (const y of r.tax.years) {
      expect(y.taxCents).toBe(incomeTax(5_000_000 + y.resultCents, t) - incomeTax(5_000_000, t));
    }
  });

  it("does not check Liebhaberei for whole buildings", () => {
    const r = underwrite({ ...BASE, property: { ...BASE.property, ownership: "wholeBuilding", unitsInBuilding: 8 }, ownerCosts: { reserveFundMonthly: 0 } });
    expect(r.tax.liebhaberei).toMatchObject({ status: "notChecked", horizonYears: null, resultByYearCents: [] });
    expect(r.flags.map((f) => f.id)).not.toContain("tax.liebhabereiRisk");
  });

  it("flags a Liebhaberei risk when there is no total surplus within 25 years", () => {
    const risky: UnderwriteInput = { ...BASE, financing: { loanAmount: 280_000, ratePct: 5, termYears: 35 }, rent: { netColdMonthly: 750 } };
    const r = underwrite(risky);
    expect(r.tax.liebhaberei.status).toBe("noTotalSurplus");
    expect(r.tax.liebhaberei.horizonYears).toBe(25);
    expect(r.flags.find((f) => f.id === "tax.liebhabereiRisk")?.severity).toBe("warn");
  });

  it("flags new buildings completed 2024 to 2026", () => {
    const year = (buildingYear: number) =>
      flagIds({ ...BASE, property: { livingAreaM2: 60, ownership: "condominium", buildingYear } }).includes("tax.newBuildAfaNotModelled");
    expect([2023, 2024, 2026, 2027].map(year)).toEqual([false, true, true, false]);
  });

  it("records the tax rules it used", () => {
    const ids = underwrite({ ...BASE, tax: { otherTaxableIncome: 50_000 } }).rulesUsed.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["at.estg.afa.buildingRate", "at.grundanteil.standardPct", "at.lvo.smallLettingYears", "at.estg.tariff.limit1", "at.estg.tariff.rate7"]));
    expect(underwrite(BASE).rulesUsed.map((r) => r.id)).not.toContain("at.estg.tariff.limit1");
  });

  it("reports every tax input problem at once", () => {
    try {
      underwrite({
        ...BASE,
        tax: { otherTaxableIncome: -1, landSharePct: 101, municipalityInhabitants: 1.5, averageLandPricePerM2: -3, typo: 1 } as never,
        assumptions: { marginalTaxRatePct: 60 },
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InputError);
      expect((error as InputError).issues.map((i) => i.path).sort()).toEqual([
        "assumptions.marginalTaxRatePct",
        "tax.averageLandPricePerM2",
        "tax.landSharePct",
        "tax.municipalityInhabitants",
        "tax.otherTaxableIncome",
        "tax.typo",
      ]);
    }
  });
});
