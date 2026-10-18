import type { Citation } from "../citations.js";
import type { IsoDate } from "../dates.js";
import { cite, type RuleTracker } from "./ruleTracker.js";

export type Ownership = "condominium" | "house" | "wholeBuilding";

export interface RentRegulationInput {
  ownership?: Ownership;
  buildingPermitDate?: IsoDate;
  buildingYear?: number;
  publicFunding?: boolean;
  unitsInBuilding?: number;
}

/**
 * - "excluded": the MRG does not apply at all (§ 1 Abs. 2 Z 5)
 * - "partial": only parts of the MRG apply; no statutory rent cap (§ 1 Abs. 4)
 * - "full": full MRG; the rent is capped (Richtwert or angemessener Mietzins, § 16)
 * - "unknown": the inputs do not settle it
 */
export type RentRegulationStatus = "excluded" | "partial" | "full" | "unknown";

export interface RentRegulation {
  status: RentRegulationStatus;
  /** What the status rests on: the permit date (statutory test), the build year (estimate), or the unit count. */
  basis: "unitCount" | "permitDate" | "buildingYear" | "none";
  summary: string;
  citations: Citation[];
}

/**
 * Using the build year when the permit date is unknown (heuristic, not law):
 * a building completed at least `before` years before the cut-off year had its
 * permit before the cut-off; one completed at least `after` years later had its
 * permit after it. Years in between are inconclusive, because a building is
 * completed some time after its permit (longer if construction stalled).
 * E.g. for 8 May 1945: up to 1944 → before, from 1950 → after, 1945–1949 → unknown.
 */
export const BUILDING_YEAR_MARGIN = { before: 1, after: 5 } as const;

type Tri = boolean | undefined;

export function permitAfter(cutoff: IsoDate, input: RentRegulationInput): { after: Tri; basis: RentRegulation["basis"] } {
  if (input.buildingPermitDate !== undefined) {
    return { after: input.buildingPermitDate > cutoff, basis: "permitDate" };
  }
  if (input.buildingYear !== undefined) {
    const cutoffYear = Number(cutoff.slice(0, 4));
    if (input.buildingYear <= cutoffYear - BUILDING_YEAR_MARGIN.before) return { after: false, basis: "buildingYear" };
    if (input.buildingYear >= cutoffYear + BUILDING_YEAR_MARGIN.after) return { after: true, basis: "buildingYear" };
    return { after: undefined, basis: "buildingYear" };
  }
  return { after: undefined, basis: "none" };
}

/**
 * Classifies whether the MRG's rent caps can apply, using the building-size
 * exclusion (§ 1 Abs. 2 Z 5) and the permit-date rules (§ 1 Abs. 4 Z 1 and Z 3).
 * Attic conversions, extensions and other special cases are not checked.
 */
export function classifyRentRegulation(input: RentRegulationInput, rules: RuleTracker): RentRegulation {
  const maxUnits = rules.numeric("at.mrg.exclusionMaxUnits");
  const units = input.unitsInBuilding ?? (input.ownership === "house" ? 1 : undefined);
  if (units !== undefined && units <= maxUnits.value) {
    return {
      status: "excluded",
      basis: "unitCount",
      summary: `The building has at most ${maxUnits.value} separate units, so the MRG does not apply and the rent is freely agreed.`,
      citations: [cite(maxUnits)],
    };
  }

  const condo = rules.date("at.mrg.condominiumPermitAfter");
  const newBuilding = rules.date("at.mrg.newBuildingPermitAfter");
  const z3 = permitAfter(condo.value, input);
  const z1 = permitAfter(newBuilding.value, input);
  const noPublicFunds: Tri = input.publicFunding === undefined ? undefined : !input.publicFunding;
  const basis = z3.basis === "none" ? z1.basis : z3.basis;
  const estimate = basis === "buildingYear" ? " (estimated from the build year; confirm the Baubewilligung date)" : "";

  // Z 3: flat in Wohnungseigentum, permit after 8 May 1945.
  const condoPartial: Tri = z3.after;
  // Z 1: new building without public funds, permit after 30 June 1953.
  const buildingPartial: Tri =
    z1.after === false || noPublicFunds === false ? false : z1.after === true && noPublicFunds === true ? true : undefined;

  let partial: Tri;
  if (input.ownership === "condominium") partial = condoPartial === true || buildingPartial === true ? true : condoPartial;
  else if (input.ownership === "wholeBuilding") partial = buildingPartial;
  else partial = condoPartial === true && buildingPartial === true ? true : condoPartial === false && buildingPartial === false ? false : undefined;

  const citations = [cite(condo), cite(newBuilding)];
  if (partial === true) {
    return {
      status: "partial",
      basis,
      summary: `Only parts of the MRG apply, so there is no statutory rent cap${estimate}. Tenancy protection and minimum fixed terms still apply.`,
      citations,
    };
  }
  if (partial === false) {
    return {
      status: "full",
      basis,
      summary: `The MRG applies in full, so the rent is capped (Richtwert or angemessener Mietzins under § 16 MRG)${estimate}.`,
      citations,
    };
  }
  const missing: string[] = [];
  if (input.ownership === undefined) missing.push("ownership (condominium, house or whole building)");
  if (z3.after === undefined && z1.after === undefined) missing.push("the Baubewilligung date");
  else if (input.ownership !== "condominium" && noPublicFunds === undefined) missing.push("whether the building was publicly funded");
  return {
    status: "unknown",
    basis,
    summary: `Whether the MRG caps the rent cannot be determined${missing.length ? `; provide ${missing.join(" and ")}` : ""}${estimate}.`,
    citations,
  };
}
