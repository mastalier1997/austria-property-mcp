import { SOURCES } from "../citations.js";
import type { Rule } from "./types.js";

const DESCRIPTION =
  "Minimum monthly contribution to the repair reserve (Rücklage) per m² of usable floor area";
const METHOD =
  "§ 31 WEG: €0.90 per m², index-linked to VPI 2020 (base June 2021 = 102.6) every second year from 2024; " +
  "the Wirtschaftskammer publishes the new amount by the end of November of the preceding year.";

export const WEG_RULES: Rule[] = [
  {
    id: "at.weg.minReservePerM2",
    description: DESCRIPTION,
    unit: "cents",
    value: 90,
    validFrom: "2022-07-01",
    validTo: "2023-12-31",
    legalBasis: "§ 31 Abs. 1 WEG 2002 idF BGBl. I Nr. 222/2021",
    sourceUrl: SOURCES.weg31,
    verifiedOn: "2026-10-18",
    note: `Base amount in force since 2022-07-01. ${METHOD}`,
  },
  {
    id: "at.weg.minReservePerM2",
    description: DESCRIPTION,
    unit: "cents",
    value: 106,
    validFrom: "2024-01-01",
    validTo: "2025-12-31",
    legalBasis: "§ 31 WEG 2002 (valorised amount)",
    sourceUrl: SOURCES.weg31,
    publicationUrl: SOURCES.oviReserve2026,
    verifiedOn: "2026-10-18",
    note: `${METHOD} Amount taken from ÖVI's notice (previous amount €1.06); the Wirtschaftskammer's 2024 publication itself was not checked.`,
  },
  {
    id: "at.weg.minReservePerM2",
    description: DESCRIPTION,
    unit: "cents",
    value: 112,
    validFrom: "2026-01-01",
    validTo: "2027-12-31",
    legalBasis: "§ 31 WEG 2002 (valorised amount)",
    sourceUrl: SOURCES.weg31,
    publicationUrl: SOURCES.wkoReserve2026,
    verifiedOn: "2026-10-18",
    note:
      `${METHOD} Wirtschaftskammer notice of 2025-09-10: 0.90 × 128.1 / 102.6 = €1.1237, rounded to €1.12. ` +
      "Ends 2027-12-31 because the next valorisation takes effect on 2028-01-01.",
  },
];
