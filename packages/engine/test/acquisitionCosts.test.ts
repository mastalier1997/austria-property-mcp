import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acquisitionCosts,
  ENGINE_VERSION,
  InputError,
  RuleNotCoveredError,
  type AcquisitionCostsInput,
} from "../src/index.js";

const BASE: AcquisitionCostsInput = {
  valuationDate: "2026-10-18",
  purchasePrice: 250_000,
  broker: { commissionPct: 3, sellerPaysCommission: true },
  financing: { loanAmount: 200_000 },
};

const item = (input: AcquisitionCostsInput, id: string) =>
  acquisitionCosts(input).lineItems.find((i) => i.id === id);

describe("acquisitionCosts", () => {
  it("matches the package version", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8"));
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it("is deterministic", () => {
    expect(acquisitionCosts(BASE)).toEqual(acquisitionCosts(structuredClone(BASE)));
  });

  it("cites a legal basis for every statutory line item", () => {
    const result = acquisitionCosts(BASE);
    for (const line of result.lineItems) {
      if (line.ruleIds.length === 0) continue;
      expect(line.citations.length, line.id).toBeGreaterThan(0);
      for (const ruleId of line.ruleIds) {
        expect(result.rulesUsed.some((r) => r.id === ruleId), `${line.id} → ${ruleId}`).toBe(true);
      }
    }
  });

  it("reports amounts in cents and euros consistently", () => {
    const result = acquisitionCosts(BASE);
    for (const line of result.lineItems) expect(line.amount).toBe(line.amountCents / 100);
    expect(result.total).toBe(result.totalCents / 100);
  });

  it("never lets the direct-debit reduction push the ownership fee below zero", () => {
    // 1.1% of €2,000 = €22, less than the €30 reduction.
    const line = item({ ...BASE, purchasePrice: 2_000, broker: "none", financing: undefined }, "grundbuch.eigentum");
    expect(line?.amountCents).toBe(0);
  });

  it("applies no reduction and adds the surcharge for paper filing", () => {
    const paper = { ...BASE, assumptions: { grundbuchFiling: "paper" as const } };
    expect(item(paper, "grundbuch.eigentum")?.amountCents).toBe(275_000);
    expect(item(paper, "grundbuch.eingabe")?.amountCents).toBe(8_500);
  });

  it("uses an explicit registered mortgage amount without flagging an assumption", () => {
    const input = { ...BASE, financing: { loanAmount: 200_000, registeredMortgageAmount: 240_000 } };
    expect(item(input, "grundbuch.pfandrecht")?.amountCents).toBe(288_000);
    expect(acquisitionCosts(input).flags.map((f) => f.id)).not.toContain("assumption.mortgageRegistration");
  });

  it("omits the mortgage line when there is no loan", () => {
    expect(item({ ...BASE, financing: { loanAmount: 0 } }, "grundbuch.pfandrecht")).toBeUndefined();
  });

  it("omits broker and contract lines when they are zero", () => {
    const result = acquisitionCosts({ ...BASE, broker: { commissionPct: 0 }, assumptions: { contractFeePct: 0 } });
    expect(result.lineItems.map((l) => l.id)).toEqual([
      "grest",
      "grundbuch.eigentum",
      "grundbuch.pfandrecht",
      "grundbuch.eingabe",
    ]);
  });

  it("records which assumptions were defaulted", () => {
    const result = acquisitionCosts({ ...BASE, assumptions: { contractFeePct: 2 } });
    expect(result.assumptionsDefaulted).toEqual([
      "mortgageRegistrationFactor",
      "grundbuchFiling",
      "grundbuchApplications",
    ]);
    expect(result.assumptionsUsed.contractFeePct).toBe(2);
  });

  it("throws RuleNotCoveredError for dates before the rule catalogue's coverage", () => {
    expect(() => acquisitionCosts({ ...BASE, valuationDate: "2025-03-31" })).toThrow(RuleNotCoveredError);
  });

  it("reports every input problem at once", () => {
    const bad = {
      valuationDate: "2026-13-01",
      purchasePrice: -5,
      broker: { commissionPct: 12 },
      financing: { loanAmount: 1.234 },
      assumptions: { contractFeePct: 50, foo: 1, grundbuchApplications: 1.5 },
    } as unknown as AcquisitionCostsInput;
    try {
      acquisitionCosts(bad);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InputError);
      const paths = (error as InputError).issues.map((i) => i.path).sort();
      expect(paths).toEqual([
        "assumptions.contractFeePct",
        "assumptions.foo",
        "assumptions.grundbuchApplications",
        "broker.commissionPct",
        "financing.loanAmount",
        "purchasePrice",
        "valuationDate",
      ]);
    }
  });

  it("rejects prices with more than two decimals", () => {
    expect(() => acquisitionCosts({ ...BASE, purchasePrice: 100_000.001 })).toThrow(InputError);
  });
});
