import { SOURCES } from "../citations.js";
import type { Rule } from "./types.js";

export const UST_RULES: Rule[] = [
  {
    id: "at.ust.standardRate",
    description: "Standard VAT rate (Normalsteuersatz), e.g. on broker and notary fees",
    unit: "ppm",
    value: 200_000,
    validFrom: "2016-01-01",
    legalBasis: "§ 10 Abs. 1 UStG 1994",
    sourceUrl: SOURCES.ustg10,
    verifiedOn: "2026-10-18",
    note:
      "Checked in the version in force since 2026-07-01. The 20% standard rate is long-standing; " +
      "earlier versions back to validFrom were not individually checked.",
  },
];
