import type { Citation } from "../citations.js";
import { divRound, formatEur, formatPpm, percent, PPM_PER_UNIT, type Cents } from "../money.js";
import { RuleNotCoveredError, type RuleId } from "../rules/index.js";
import { permitAfter, type RentRegulation, type RentRegulationInput } from "./rentRegulation.js";
import { cite, type RuleTracker } from "./ruleTracker.js";

export const AUSTRIAN_STATES = [
  "burgenland",
  "kaernten",
  "niederoesterreich",
  "oberoesterreich",
  "salzburg",
  "steiermark",
  "tirol",
  "vorarlberg",
  "wien",
] as const;

/** Bundesland, in lowercase ASCII (ä → ae, ö → oe). */
export type AustrianState = (typeof AUSTRIAN_STATES)[number];

const RICHTWERT_RULE: Record<AustrianState, RuleId> = {
  burgenland: "at.richtwert.burgenland",
  kaernten: "at.richtwert.kaernten",
  niederoesterreich: "at.richtwert.niederoesterreich",
  oberoesterreich: "at.richtwert.oberoesterreich",
  salzburg: "at.richtwert.salzburg",
  steiermark: "at.richtwert.steiermark",
  tirol: "at.richtwert.tirol",
  vorarlberg: "at.richtwert.vorarlberg",
  wien: "at.richtwert.wien",
};

/**
 * - "richtwert": the Richtwert applies; the base amount is computed
 * - "angemessen": the angemessener Hauptmietzins applies instead (§ 16 Abs. 1 MRG); not computed
 * - "noCap": the MRG does not cap the rent (excluded or partial application)
 * - "unknown": inputs missing, or the Richtwert for the date is not published yet
 */
export type RentCapStatus = "richtwert" | "angemessen" | "noCap" | "unknown";

export interface RentCap {
  status: RentCapStatus;
  state: AustrianState | null;
  /** Richtwert on the valuation date, cents per m² of usable floor area per month. */
  richtwertPerM2Cents: Cents | null;
  /** Whether the lease is fixed-term, as given; null if unknown. */
  fixedTerm: boolean | null;
  /** Richtwert × floor area for an open-ended lease, before Zuschläge and Abschläge. */
  openEndedBaseCents: Cents | null;
  /** The same, less 25% for a fixed-term lease (§ 16 Abs. 7 MRG). */
  fixedTermBaseCents: Cents | null;
  /** The base for the given lease type; the open-ended base if the lease type is unknown. */
  applicableBaseCents: Cents | null;
  /** Assumed net cold rent as % of the applicable base. */
  rentToBasePct: number | null;
  explanation: string;
  ruleIds: RuleId[];
  citations: Citation[];
}

export interface RentCapInput {
  regulation: RentRegulation;
  property: RentRegulationInput & { state?: AustrianState };
  /** Usable floor area in hundredths of a m². */
  areaHundredths: number | undefined;
  fixedTerm: boolean | undefined;
  /** Assumed monthly net cold rent. */
  rentCents: Cents;
}

const empty = (status: RentCapStatus, input: RentCapInput, explanation: string, ruleIds: RuleId[] = [], citations: Citation[] = []): RentCap => ({
  status,
  state: input.property.state ?? null,
  richtwertPerM2Cents: null,
  fixedTerm: input.fixedTerm ?? null,
  openEndedBaseCents: null,
  fixedTermBaseCents: null,
  applicableBaseCents: null,
  rentToBasePct: null,
  explanation,
  ruleIds,
  citations,
});

/**
 * The statutory cap on the net cold rent (Hauptmietzins) for a fully regulated
 * flat. Computes the Richtwert base: Richtwert × usable floor area, less 25%
 * for a fixed-term lease. Zuschläge and Abschläge (features, location,
 * condition, Ausstattungskategorie) depend on the flat and are not computed.
 */
export function rentCap(input: RentCapInput, rules: RuleTracker): RentCap {
  const { regulation, property } = input;
  if (regulation.status === "excluded" || regulation.status === "partial") {
    return empty("noCap", input, "The MRG does not cap the rent for this flat, so no Richtwert applies.");
  }

  // § 16 Abs. 1 Z 2: newly built under a permit after 8 May 1945
  const cutoff = rules.date("at.mrg.angemessenPermitAfter");
  const z2 = permitAfter(cutoff.value, property);
  if (z2.after === true) {
    return empty(
      "angemessen",
      input,
      `The building was permitted after ${cutoff.value}${z2.basis === "buildingYear" ? ` (estimated from the build year ${property.buildingYear})` : ""}, ` +
        "so the angemessener Hauptmietzins applies instead of the Richtwert. It is set by comparison with similar flats and is not computed. " +
        (property.publicFunding === true ? "Subsidy conditions may cap the rent separately. " : "") +
        "A fixed-term lease lowers it by 25%.",
      [cutoff.id],
      [cite(cutoff)],
    );
  }

  // § 16 Abs. 1 Z 4: Kategorie A or B over 130 m² (per flat; a whole building's area is the total)
  const maxArea = rules.numeric("at.mrg.angemessenMinAreaM2");
  const wholeBuilding = property.ownership === "wholeBuilding";
  if (!wholeBuilding && input.areaHundredths !== undefined && input.areaHundredths > maxArea.value * 100) {
    return empty(
      "angemessen",
      input,
      `The flat has more than ${maxArea.value} m², so for Ausstattungskategorie A or B the angemessener Hauptmietzins applies instead of the Richtwert, ` +
        "provided it is re-let within six months of the previous tenant leaving. It is not computed. A fixed-term lease lowers it by 25%.",
      [cutoff.id, maxArea.id],
      [cite(maxArea)],
    );
  }

  const missing: string[] = [];
  if (property.state === undefined) missing.push("property.state");
  if (input.areaHundredths === undefined) missing.push("property.livingAreaM2");
  if (missing.length > 0) {
    return empty("unknown", input, `To compute the Richtwert cap, pass ${missing.join(" and ")}.`, [cutoff.id, maxArea.id]);
  }
  const state = property.state!;
  const area = input.areaHundredths!;

  let richtwert;
  try {
    richtwert = rules.numeric(RICHTWERT_RULE[state]);
  } catch (error) {
    if (!(error instanceof RuleNotCoveredError)) throw error;
    return empty(
      "unknown",
      input,
      `The Richtwerte valid on ${rules.valuationDate} are not published yet. They change every 1 April (§ 5 Abs. 2 RichtWG); the 2027 increase is capped at 2%.`,
      [cutoff.id, maxArea.id],
    );
  }
  const reduction = rules.numeric("at.mrg.fixedTermReduction");
  const exact = BigInt(richtwert.value) * BigInt(area); // cents × hundredths of m²
  const openEnded = Number(divRound(exact, 100n, "halfUp"));
  const fixedTerm = Number(divRound(exact * BigInt(PPM_PER_UNIT - reduction.value), 100n * BigInt(PPM_PER_UNIT), "halfUp"));
  const applicable = input.fixedTerm === true ? fixedTerm : openEnded;

  const m2 = area / 100;
  const caveats: string[] = [];
  if (regulation.status === "unknown") caveats.push("This applies only if the MRG applies in full, which the inputs do not settle.");
  if (z2.after === undefined) caveats.push(`It assumes the building permit predates ${cutoff.value}; otherwise the angemessener Hauptmietzins applies.`);
  if (wholeBuilding) {
    caveats.push(
      `For a whole building this is the total over all flats; business premises and Kategorie A or B flats over ${maxArea.value} m² may be let at the angemessener Hauptmietzins instead.`,
    );
  }
  const lease =
    input.fixedTerm === true
      ? `${formatEur(fixedTerm)} for the fixed-term lease (${formatEur(openEnded)} less ${formatPpm(reduction.value)})`
      : input.fixedTerm === false
        ? `${formatEur(openEnded)} for the open-ended lease`
        : `${formatEur(openEnded)} for an open-ended lease, ${formatEur(fixedTerm)} if fixed-term (−${formatPpm(reduction.value)}; pass rent.fixedTerm)`;
  return {
    status: "richtwert",
    state,
    richtwertPerM2Cents: richtwert.value,
    fixedTerm: input.fixedTerm ?? null,
    openEndedBaseCents: openEnded,
    fixedTermBaseCents: fixedTerm,
    applicableBaseCents: applicable,
    rentToBasePct: applicable > 0 ? percent(input.rentCents, applicable) : null,
    explanation:
      `Richtwert ${formatEur(richtwert.value)} per m² × ${m2} m² = ${lease}, before Zuschläge and Abschläge. ` +
      "Above-standard features and an above-average location (disclosed in writing) can raise the cap; Kategorie B or C, lower standards or poor condition lower it." +
      (caveats.length > 0 ? ` ${caveats.join(" ")}` : ""),
    ruleIds: [richtwert.id, reduction.id, cutoff.id, maxArea.id],
    citations: [cite(richtwert), cite(reduction)],
  };
}
