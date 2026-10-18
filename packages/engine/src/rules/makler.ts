import { SOURCES } from "../citations.js";
import type { Rule } from "./types.js";

const MAKLER = "Standes- und Ausübungsregeln für Immobilienmakler";
const NOTE =
  "BGBl. Nr. 297/1996; § 15 Abs. 2 rates in force since 2002-01-01 (BGBl. II Nr. 490/2001). " +
  "The cap applies per party and excludes USt (§ 12 Abs. 1).";

export const MAKLER_RULES: Rule[] = [
  {
    id: "at.makler.lowerBracketLimit",
    description: "Upper limit of the lower bracket for the maximum broker commission on a purchase",
    unit: "cents",
    value: 3_633_642,
    validFrom: "2002-01-01",
    legalBasis: `§ 15 Abs. 2 Z 1 ${MAKLER}`,
    sourceUrl: SOURCES.makler,
    verifiedOn: "2026-10-18",
    note: NOTE,
  },
  {
    id: "at.makler.lowerBracketRate",
    description: "Maximum broker commission per party, value up to the lower bracket limit",
    unit: "ppm",
    value: 40_000,
    validFrom: "2002-01-01",
    legalBasis: `§ 15 Abs. 2 Z 1 ${MAKLER}`,
    sourceUrl: SOURCES.makler,
    verifiedOn: "2026-10-18",
    note: NOTE,
  },
  {
    id: "at.makler.upperBracketRate",
    description: "Maximum broker commission per party, value above the lower bracket limit",
    unit: "ppm",
    value: 30_000,
    validFrom: "2002-01-01",
    legalBasis: `§ 15 Abs. 2 Z 2 ${MAKLER}`,
    sourceUrl: SOURCES.makler,
    verifiedOn: "2026-10-18",
    note: NOTE,
  },
  {
    id: "at.makler.oneSidedIncrease",
    description:
      "How far one party's commission may exceed the cap if the other party pays no commission",
    unit: "ppm",
    value: 1_000_000,
    validFrom: "2002-01-01",
    legalBasis: `§ 12 Abs. 2 ${MAKLER}`,
    sourceUrl: SOURCES.makler,
    verifiedOn: "2026-10-18",
    note:
      "Up to 100% above the cap if no commission is agreed with the other party. " +
      "If the other party's commission stays below the cap, the excess is limited to that shortfall. " +
      "validFrom not separately checked for § 12; set to match § 15.",
  },
];
