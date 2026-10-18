import { SOURCES } from "../citations.js";
import type { Rule } from "./types.js";

export const GREST_RULES: Rule[] = [
  {
    id: "at.grest.rate",
    description: "Grunderwerbsteuer rate for acquisitions for consideration (entgeltlicher Erwerb)",
    unit: "ppm",
    value: 35_000,
    validFrom: "2016-01-01",
    legalBasis: "§ 7 Abs. 1 Z 3 GrEStG 1987",
    sourceUrl: SOURCES.grestg7,
    verifiedOn: "2026-10-18",
    note:
      "Checked in the version in force since 2026-04-01 (BGBl. I Nr. 97/2025) and in the 2009 version; " +
      "the 3.5% rate for acquisitions from third parties is unchanged across versions. " +
      "validFrom marks the start of the current tariff structure (StRefG 2015/2016).",
  },
];
