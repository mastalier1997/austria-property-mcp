import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { underwrite, type UnderwriteInput } from "../src/index.js";

interface GoldenUnderwrite {
  name: string;
  input: UnderwriteInput;
  expected: {
    acquisitionTotalCents: number;
    financing: {
      monthlyPaymentCents: number;
      year1InterestCents: number;
      year1PrincipalCents: number;
      totalInterestCents: number;
      ltvPct: number;
    } | null;
    operating: Record<string, number>;
    metrics: {
      monthlyNoiCents: number;
      monthlyCashFlowCents: number;
      grossYieldPct: number;
      netYieldPct: number;
      cashOnCashPct: number | null;
      dscr: number | null;
      totalInvestmentCents: number;
      equityCents: number;
      breakEvenRentCents: number | null;
      breakEvenRentPerM2: number | null;
    };
    rentRegulation: { status: string; basis: string };
    rentCap: {
      status: string;
      richtwertPerM2Cents: number | null;
      openEndedBaseCents: number | null;
      fixedTermBaseCents: number | null;
      applicableBaseCents: number | null;
      rentToBasePct: number | null;
    };
    fullMrgSeverity: string | null;
    tax: {
      method: string;
      marginalRatePct: number;
      landSharePct: number;
      afa: { costBasisCents: number; landShareCents: number; buildingCents: number };
      loanCosts: { totalCents: number; spreadYears: number } | null;
      years: Record<string, number>[];
      monthlyCashFlowAfterTaxYear1Cents: number;
      liebhaberei: { status: string; cumulativeResultCents: number | null; totalSurplusFromYear: number | null };
    };
    flags: string[];
  };
}

const dir = join(import.meta.dirname, "../../../fixtures/golden/underwrite");
const cases: GoldenUnderwrite[] = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as GoldenUnderwrite);

describe("golden underwriting cases", () => {
  it("has fixtures", () => {
    expect(cases.length).toBeGreaterThanOrEqual(26);
  });

  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, golden) => {
    const result = underwrite(golden.input);
    const e = golden.expected;

    expect(result.acquisition.totalCents).toBe(e.acquisitionTotalCents);

    if (e.financing === null) {
      expect(result.financing).toBeNull();
    } else {
      expect(result.financing).toMatchObject(e.financing);
    }

    const operating = Object.fromEntries(result.operating.map((l) => [l.id, l.amountCents]));
    expect(operating).toEqual(e.operating);

    expect(result.metrics).toMatchObject(e.metrics);
    expect(result.metrics.annualNoiCents).toBe(e.metrics.monthlyNoiCents * 12);
    expect(result.metrics.annualCashFlowCents).toBe(e.metrics.monthlyCashFlowCents * 12);

    expect({ status: result.rentRegulation.status, basis: result.rentRegulation.basis }).toEqual(e.rentRegulation);

    expect(result.rentCap).toMatchObject(e.rentCap);
    expect(result.flags.find((f) => f.id === "rent.fullMrg")?.severity ?? null).toBe(e.fullMrgSeverity);

    const t = result.tax;
    expect(t.method).toBe(e.tax.method);
    expect(t.marginalRatePct).toBe(e.tax.marginalRatePct);
    expect(t.landShare.pct).toBe(e.tax.landSharePct);
    expect(t.afa).toMatchObject(e.tax.afa);
    if (e.tax.loanCosts === null) expect(t.loanCosts).toBeNull();
    else expect(t.loanCosts).toMatchObject(e.tax.loanCosts);
    expect(t.years).toEqual(e.tax.years);
    expect(t.monthlyCashFlowAfterTaxYear1Cents).toBe(e.tax.monthlyCashFlowAfterTaxYear1Cents);
    expect({
      status: t.liebhaberei.status,
      cumulativeResultCents: t.liebhaberei.cumulativeResultCents,
      totalSurplusFromYear: t.liebhaberei.totalSurplusFromYear,
    }).toEqual(e.tax.liebhaberei);
    expect(result.flags.map((f) => f.id).sort()).toEqual(e.flags);
  });
});
