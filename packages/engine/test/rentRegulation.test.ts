import { describe, expect, it } from "vitest";
import { underwrite, type PropertyInput, type RentRegulationStatus } from "../src/index.js";

const status = (property: PropertyInput): { status: RentRegulationStatus; basis: string } => {
  const r = underwrite({
    valuationDate: "2026-10-18",
    purchasePrice: 200_000,
    broker: "none",
    property: { livingAreaM2: 50, ...property },
    rent: { netColdMonthly: 800 },
  }).rentRegulation;
  return { status: r.status, basis: r.basis };
};

describe("rent regulation (§ 1 MRG)", () => {
  describe("condominium: permit after 8 May 1945 (§ 1 Abs. 4 Z 3)", () => {
    it.each([
      ["1945-05-08", "full"],
      ["1945-05-09", "partial"],
      ["1952-01-01", "partial"],
    ] as const)("permit %s → %s", (date, expected) => {
      expect(status({ ownership: "condominium", buildingPermitDate: date })).toEqual({ status: expected, basis: "permitDate" });
    });
  });

  describe("whole building: permit after 30 June 1953 and no public funds (§ 1 Abs. 4 Z 1)", () => {
    it.each([
      ["1953-06-30", false, "full"],
      ["1953-07-01", false, "partial"],
      ["1953-07-01", true, "full"],
      ["1953-07-01", undefined, "unknown"],
      ["1950-01-01", undefined, "full"],
    ] as const)("permit %s, public funds %s → %s", (date, publicFunding, expected) => {
      const property: PropertyInput = { ownership: "wholeBuilding", buildingPermitDate: date, unitsInBuilding: 8 };
      if (publicFunding !== undefined) property.publicFunding = publicFunding;
      expect(status(property).status).toBe(expected);
    });
  });

  describe("small buildings are excluded (§ 1 Abs. 2 Z 5)", () => {
    it.each([
      [1, "excluded"],
      [2, "excluded"],
      [3, "full"],
    ] as const)("%d units, permit 1900 → %s", (units, expected) => {
      expect(status({ ownership: "condominium", buildingPermitDate: "1900-01-01", unitsInBuilding: units }).status).toBe(expected);
    });

    it("treats a house as one unit", () => {
      expect(status({ ownership: "house" })).toEqual({ status: "excluded", basis: "unitCount" });
    });
  });

  describe("build year as an estimate", () => {
    it.each([
      [1944, "full"],
      [1945, "unknown"],
      [1949, "unknown"],
      [1950, "partial"],
    ] as const)("condominium built %d → %s", (year, expected) => {
      expect(status({ ownership: "condominium", buildingYear: year })).toEqual({ status: expected, basis: "buildingYear" });
    });

    it("prefers the permit date over the build year", () => {
      expect(status({ ownership: "condominium", buildingYear: 1980, buildingPermitDate: "1940-01-01" })).toEqual({
        status: "full",
        basis: "permitDate",
      });
    });
  });

  describe("unknown ownership", () => {
    it("is settled when both tests agree", () => {
      expect(status({ buildingPermitDate: "1930-01-01" }).status).toBe("full");
      expect(status({ buildingPermitDate: "1990-01-01", publicFunding: false }).status).toBe("partial");
    });

    it("stays unknown when they disagree", () => {
      expect(status({ buildingPermitDate: "1950-01-01" }).status).toBe("unknown");
    });

    it("is unknown without any building data", () => {
      expect(status({})).toEqual({ status: "unknown", basis: "none" });
    });
  });
});
