import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AUSTRIAN_STATES, InputError, underwrite, type AustrianState, type PropertyInput, type UnderwriteInput } from "../src/index.js";

const BASE: UnderwriteInput = {
  valuationDate: "2026-10-18",
  purchasePrice: 250_000,
  broker: "none",
  property: { livingAreaM2: 60, ownership: "condominium", buildingPermitDate: "1900-01-01", state: "wien" },
  rent: { netColdMonthly: 400, operatingCostsMonthly: 150 },
  ownerCosts: { reserveFundMonthly: 60 },
};

const withProperty = (property: PropertyInput, extra: Partial<UnderwriteInput> = {}): UnderwriteInput => ({ ...BASE, ...extra, property });
const cap = (input: UnderwriteInput) => underwrite(input).rentCap;
const flag = (input: UnderwriteInput, id: string) => underwrite(input).flags.find((f) => f.id === id);

// Statistik Austria / BGBl. II Nr. 81/2023, cents per m².
const RICHTWERTE: Record<AustrianState, [number, number]> = {
  burgenland: [609, 615],
  kaernten: [781, 789],
  niederoesterreich: [685, 692],
  oberoesterreich: [723, 730],
  salzburg: [922, 931],
  steiermark: [921, 930],
  tirol: [814, 822],
  vorarlberg: [1025, 1035],
  wien: [667, 674],
};

describe("Richtwert cap", () => {
  it.each(AUSTRIAN_STATES)("switches the Richtwert for %s on 1 April 2026", (state) => {
    const at = (valuationDate: string) => cap({ ...withProperty({ ...BASE.property, state }), valuationDate }).richtwertPerM2Cents;
    expect(at("2026-03-31")).toBe(RICHTWERTE[state][0]);
    expect(at("2026-04-01")).toBe(RICHTWERTE[state][1]);
    expect(at("2027-03-31")).toBe(RICHTWERTE[state][1]);
  });

  it("reports the 2027 Richtwert as not yet published instead of failing", () => {
    const r = cap({ ...BASE, valuationDate: "2027-04-01" });
    expect(r.status).toBe("unknown");
    expect(r.explanation).toMatch(/not published yet/);
  });

  it("computes the open-ended and fixed-term base", () => {
    const r = cap(BASE);
    expect(r).toMatchObject({ status: "richtwert", openEndedBaseCents: 674 * 60, fixedTermBaseCents: 674 * 45, applicableBaseCents: 674 * 60, fixedTerm: null });
    expect(r.explanation).toMatch(/pass rent\.fixedTerm/);
    expect(cap({ ...BASE, rent: { ...BASE.rent, fixedTerm: true } }).applicableBaseCents).toBe(674 * 45);
    expect(cap({ ...BASE, rent: { ...BASE.rent, fixedTerm: false } }).applicableBaseCents).toBe(674 * 60);
  });

  it("rounds the fixed-term base once, half up", () => {
    // 6.74 × 47.5 × 0.75 = 240.1125 → 240.11; 9.30 × 55 × 0.75 = 383.625 → 383.63
    expect(cap(withProperty({ ...BASE.property, livingAreaM2: 47.5 })).fixedTermBaseCents).toBe(24_011);
    expect(cap(withProperty({ ...BASE.property, livingAreaM2: 55, state: "steiermark" })).fixedTermBaseCents).toBe(38_363);
  });

  it("switches to the angemessener Mietzins above 130 m² (§ 16 Abs. 1 Z 4)", () => {
    expect(cap(withProperty({ ...BASE.property, livingAreaM2: 130 })).status).toBe("richtwert");
    expect(cap(withProperty({ ...BASE.property, livingAreaM2: 130.01 })).status).toBe("angemessen");
  });

  it("switches to the angemessener Mietzins for permits after 8 May 1945 (§ 16 Abs. 1 Z 2)", () => {
    const whole = (buildingPermitDate: string) =>
      withProperty({ livingAreaM2: 600, ownership: "wholeBuilding", buildingPermitDate, publicFunding: false, unitsInBuilding: 9, state: "wien" });
    expect(cap(whole("1945-05-08")).status).toBe("richtwert");
    expect(cap(whole("1945-05-09")).status).toBe("angemessen");
    expect(underwrite(whole("1945-05-09")).rentRegulation.status).toBe("full");
    // A condominium permitted after 8 May 1945 is only partly covered: no cap at all.
    expect(cap(withProperty({ ...BASE.property, buildingPermitDate: "1945-05-09" })).status).toBe("noCap");
  });

  it("uses the build year as an estimate and says what it assumed", () => {
    const year = (buildingYear: number) =>
      cap(withProperty({ livingAreaM2: 600, ownership: "wholeBuilding", buildingYear, publicFunding: false, unitsInBuilding: 9, state: "wien" }));
    expect(year(1944).status).toBe("richtwert");
    expect(year(1950).status).toBe("angemessen");
    expect(year(1947).status).toBe("richtwert");
    expect(year(1947).explanation).toMatch(/assumes the building permit predates 1945-05-08/);
  });

  it("has no cap when the MRG is excluded or only partly applies", () => {
    expect(cap(withProperty({ livingAreaM2: 120, ownership: "house", state: "wien" })).status).toBe("noCap");
    expect(cap(withProperty({ ...BASE.property, buildingPermitDate: "1990-01-01" })).status).toBe("noCap");
  });

  it("asks for the state and floor area", () => {
    const { state: _s, ...noState } = BASE.property!;
    expect(cap(withProperty(noState)).explanation).toMatch(/property\.state/);
    const { livingAreaM2: _a, ...noArea } = BASE.property!;
    expect(cap(withProperty(noArea, { ownerCosts: { reserveFundMonthly: 60 } })).explanation).toMatch(/property\.livingAreaM2/);
  });

  it("downgrades the full-MRG flag to info when the rent is within the base", () => {
    expect(flag(BASE, "rent.fullMrg")?.severity).toBe("info");
    expect(flag({ ...BASE, rent: { ...BASE.rent, netColdMonthly: 404.41 } }, "rent.fullMrg")?.severity).toBe("high");
    expect(flag({ ...BASE, rent: { ...BASE.rent, netColdMonthly: 404.4 } }, "rent.fullMrg")?.severity).toBe("info");
  });

  it("warns about rent above the Richtwert when the MRG status is unknown", () => {
    const { buildingPermitDate: _p, ...noPermit } = BASE.property!;
    const high = withProperty(noPermit, { rent: { netColdMonthly: 900 } });
    expect(underwrite(high).rentRegulation.status).toBe("unknown");
    expect(flag(high, "rent.aboveRichtwert")?.severity).toBe("warn");
    expect(flag(withProperty(noPermit), "rent.aboveRichtwert")).toBeUndefined();
  });

  it("records the rules it used", () => {
    const ids = underwrite(BASE).rulesUsed.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["at.richtwert.wien", "at.mrg.fixedTermReduction", "at.mrg.angemessenPermitAfter", "at.mrg.angemessenMinAreaM2"]));
  });

  it("rejects an unknown state or a non-boolean fixed term", () => {
    try {
      underwrite({ ...BASE, property: { ...BASE.property, state: "bavaria" as never }, rent: { ...BASE.rent, fixedTerm: "yes" as never } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InputError);
      expect((error as InputError).issues.map((i) => i.path).sort()).toEqual(["property.state", "rent.fixedTerm"]);
    }
  });

  it("base, fixed-term discount and ratio stay consistent", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AUSTRIAN_STATES),
        fc.integer({ min: 1, max: 13_000 }),
        fc.integer({ min: 100, max: 500_000 }),
        fc.option(fc.boolean(), { nil: undefined }),
        fc.constantFrom("2025-04-01", "2026-03-31", "2026-04-01", "2026-10-18", "2027-03-31"),
        (state, areaHundredths, rentCents, fixedTerm, valuationDate) => {
          const r = cap({
            ...BASE,
            valuationDate,
            property: { ...BASE.property, state, livingAreaM2: areaHundredths / 100 },
            rent: { netColdMonthly: rentCents / 100, ...(fixedTerm === undefined ? {} : { fixedTerm }) },
          });
          expect(r.status).toBe("richtwert");
          const exact = r.richtwertPerM2Cents! * areaHundredths; // cents × hundredths
          expect(Math.abs(r.openEndedBaseCents! * 100 - exact)).toBeLessThanOrEqual(50);
          expect(Math.abs(r.fixedTermBaseCents! * 400 - exact * 3)).toBeLessThanOrEqual(200);
          expect(r.fixedTermBaseCents!).toBeLessThanOrEqual(r.openEndedBaseCents!);
          expect(r.applicableBaseCents).toBe(fixedTerm === true ? r.fixedTermBaseCents : r.openEndedBaseCents);
          if (r.applicableBaseCents! > 0) {
            expect(Math.abs(r.rentToBasePct! - (rentCents * 100) / r.applicableBaseCents!)).toBeLessThanOrEqual(0.005 + 1e-9);
          }
        },
      ),
    );
  });
});
