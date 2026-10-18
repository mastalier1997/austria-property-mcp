import { describe, expect, it } from "vitest";
import { getRule, listRules, RULE_CATALOGUE, RuleNotCoveredError, validateCatalogue } from "../src/index.js";

describe("rule catalogue", () => {
  it("is internally consistent: no overlaps, no gaps, valid dates", () => {
    expect(validateCatalogue()).toEqual([]);
  });

  it("cites an official source for every rule", () => {
    for (const rule of RULE_CATALOGUE) {
      expect(rule.sourceUrl, rule.id).toMatch(/^https:\/\/(www\.)?ris\.bka\.gv\.at\//);
      expect(rule.legalBasis, rule.id).not.toBe("");
    }
  });

  it("detects overlapping versions", () => {
    const base = RULE_CATALOGUE.find((r) => r.id === "at.grest.rate")!;
    const problems = validateCatalogue([base, { ...base, validFrom: "2020-01-01" }]);
    expect(problems.join()).toMatch(/overlap/);
  });

  it("detects gaps between versions", () => {
    const base = RULE_CATALOGUE.find((r) => r.id === "at.grest.rate")!;
    const problems = validateCatalogue([
      { ...base, validTo: "2019-12-30" },
      { ...base, validFrom: "2020-01-01" },
    ]);
    expect(problems.join()).toMatch(/gap/);
  });
});

describe("getRule", () => {
  it("switches court-fee versions on 1 August 2026", () => {
    expect(getRule("at.ggg.eingabe.fee", "2026-07-31").value).toBe(5_800);
    expect(getRule("at.ggg.eingabe.fee", "2026-08-01").value).toBe(6_100);
    expect(getRule("at.ggg.eingabe.paperSurcharge", "2026-07-31").value).toBe(2_300);
    expect(getRule("at.ggg.eingabe.paperSurcharge", "2026-08-01").value).toBe(2_400);
    expect(getRule("at.ggg.eigentum.directDebitReduction", "2026-07-31").value).toBe(2_800);
    expect(getRule("at.ggg.eigentum.directDebitReduction", "2026-08-01").value).toBe(3_000);
  });

  it("throws RuleNotCoveredError before the first verified version", () => {
    expect(() => getRule("at.ggg.eingabe.fee", "2025-03-31")).toThrow(RuleNotCoveredError);
    expect(getRule("at.ggg.eingabe.fee", "2025-04-01").value).toBe(5_800);
  });

  it("rejects malformed dates", () => {
    expect(() => getRule("at.grest.rate", "2026-02-30")).toThrow(RangeError);
    expect(() => getRule("at.grest.rate", "18.10.2026")).toThrow(RangeError);
  });

  it("lists exactly one version per rule id for a covered date", () => {
    const rules = listRules("2026-10-18");
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(RULE_CATALOGUE.map((r) => r.id)));
  });
});
