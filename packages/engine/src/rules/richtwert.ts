import { SOURCES } from "../citations.js";
import type { Rule, RuleId } from "./types.js";

/**
 * Richtwerte per Bundesland (§ 5 RichtWG), EUR cents per m² of usable floor
 * area per month, for the mietrechtliche Normwohnung (§ 2 RichtWG).
 */

type StateValues = [RuleId, string, number, number];

// [rule id, state, cents from 2023-04-01, cents from 2026-04-01]
const STATES: StateValues[] = [
  ["at.richtwert.burgenland", "Burgenland", 609, 615],
  ["at.richtwert.kaernten", "Kärnten", 781, 789],
  ["at.richtwert.niederoesterreich", "Niederösterreich", 685, 692],
  ["at.richtwert.oberoesterreich", "Oberösterreich", 723, 730],
  ["at.richtwert.salzburg", "Salzburg", 922, 931],
  ["at.richtwert.steiermark", "Steiermark", 921, 930],
  ["at.richtwert.tirol", "Tirol", 814, 822],
  ["at.richtwert.vorarlberg", "Vorarlberg", 1025, 1035],
  ["at.richtwert.wien", "Wien", 667, 674],
];

const VERIFIED = "2026-10-18";

export const RICHTWERT_RULES: Rule[] = STATES.flatMap(([id, state, from2023, from2026]): Rule[] => [
  {
    id,
    description: `Richtwert for ${state}, per m² of usable floor area per month`,
    unit: "cents",
    value: from2023,
    validFrom: "2023-04-01",
    validTo: "2026-03-31",
    legalBasis: "§ 5 Abs. 2 RichtWG; Kundmachung BGBl. II Nr. 81/2023",
    sourceUrl: SOURCES.richtwerte2023,
    verifiedOn: VERIFIED,
    note:
      "Amount checked in BGBl. II Nr. 81/2023 (effective 2023-04-01). § 5 Abs. 2 RichtWG idF BGBl. I Nr. 114/2025 provides no adjustment between 2023 and 2026 " +
      "(the 2025 adjustment was cancelled), and Statistik Austria lists this amount as valid until 2026-03-31.",
  },
  {
    id,
    description: `Richtwert for ${state}, per m² of usable floor area per month`,
    unit: "cents",
    value: from2026,
    validFrom: "2026-04-01",
    validTo: "2027-03-31",
    legalBasis: "§ 5 Abs. 2 RichtWG idF BGBl. I Nr. 114/2025",
    sourceUrl: SOURCES.richtwg5,
    publicationUrl: SOURCES.richtwerte2026,
    verifiedOn: VERIFIED,
    note:
      "Published by Statistik Austria, which the law designates (no separate Kundmachung). The 2026 increase is capped at 1%; each amount equals the 2023 amount × 1.01, " +
      "rounded to the cent as § 5 Abs. 2 prescribes. The next adjustment is on 2027-04-01, capped at 2%.",
  },
]);
