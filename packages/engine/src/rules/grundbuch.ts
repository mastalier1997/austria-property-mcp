import { SOURCES } from "../citations.js";
import type { Rule } from "./types.js";

const PERCENT_NOTE =
  "Checked in the TP 9 versions of 2014 and 2022. The valorisation regulations " +
  "BGBl. II Nr. 51/2025 and Nr. 227/2026 change only fixed euro amounts, not these rates.";

export const GRUNDBUCH_RULES: Rule[] = [
  {
    id: "at.ggg.eigentum.rate",
    description: "Court fee for registering ownership (Eintragung des Eigentumsrechts)",
    unit: "ppm",
    value: 11_000,
    validFrom: "2014-01-01",
    legalBasis: "TP 9 lit. b Z 1 GGG",
    sourceUrl: SOURCES.ggg,
    verifiedOn: "2026-10-18",
    note: PERCENT_NOTE,
  },
  {
    id: "at.ggg.pfandrecht.rate",
    description: "Court fee for registering a mortgage (Eintragung des Pfandrechts)",
    unit: "ppm",
    value: 12_000,
    validFrom: "2014-01-01",
    legalBasis: "TP 9 lit. b Z 4 GGG",
    sourceUrl: SOURCES.ggg,
    verifiedOn: "2026-10-18",
    note: PERCENT_NOTE,
  },

  // Fixed amounts, valorised by regulation under § 31a GGG.
  {
    id: "at.ggg.eingabe.fee",
    description: "Filing fee per Grundbuch application (Eingabengebühr), electronic filing",
    unit: "cents",
    value: 5_800,
    validFrom: "2025-04-01",
    validTo: "2026-07-31",
    legalBasis: "TP 9 lit. a GGG idF BGBl. II Nr. 51/2025",
    sourceUrl: SOURCES.gggValorisation2025,
    verifiedOn: "2026-10-18",
    note: "Applies to fee claims arising after 2025-03-31 (Art. I Z 12 BGBl. II Nr. 51/2025: €47 → €58).",
  },
  {
    id: "at.ggg.eingabe.fee",
    description: "Filing fee per Grundbuch application (Eingabengebühr), electronic filing",
    unit: "cents",
    value: 6_100,
    validFrom: "2026-08-01",
    legalBasis: "TP 9 lit. a GGG idF BGBl. II Nr. 227/2026",
    sourceUrl: SOURCES.gggValorisation2026,
    verifiedOn: "2026-10-18",
    note: "Applies to fee claims arising after 2026-07-31 (Art. I Z 12a BGBl. II Nr. 227/2026: €58 → €61).",
  },
  {
    id: "at.ggg.eingabe.paperSurcharge",
    description: "Surcharge on the filing fee if not filed electronically (ERV)",
    unit: "cents",
    value: 2_300,
    validFrom: "2025-04-01",
    validTo: "2026-07-31",
    legalBasis: "TP 9 Anm. 1a GGG idF BGBl. II Nr. 51/2025",
    sourceUrl: SOURCES.gggValorisation2025,
    verifiedOn: "2026-10-18",
    note: "€19 → €23 (Art. I Z 12 BGBl. II Nr. 51/2025).",
  },
  {
    id: "at.ggg.eingabe.paperSurcharge",
    description: "Surcharge on the filing fee if not filed electronically (ERV)",
    unit: "cents",
    value: 2_400,
    validFrom: "2026-08-01",
    legalBasis: "TP 9 Anm. 1a GGG idF BGBl. II Nr. 227/2026",
    sourceUrl: SOURCES.gggValorisation2026,
    verifiedOn: "2026-10-18",
    note:
      "€23 → €24 (Art. I Z 12b BGBl. II Nr. 227/2026). " +
      "oesterreich.gv.at quotes €85, which is the paper price: €61 + €24.",
  },
  {
    id: "at.ggg.eigentum.directDebitReduction",
    description:
      "Reduction of the ownership registration fee when paid by Abbuchung und Einziehung (direct debit)",
    unit: "cents",
    value: 2_800,
    validFrom: "2025-04-01",
    validTo: "2026-07-31",
    legalBasis: "TP 9 Anm. 6 GGG idF BGBl. II Nr. 51/2025",
    sourceUrl: SOURCES.gggValorisation2025,
    verifiedOn: "2026-10-18",
    note: "€23 → €28 (Art. I Z 12 BGBl. II Nr. 51/2025). Applies to TP 9 lit. b Z 1 and Z 3.",
  },
  {
    id: "at.ggg.eigentum.directDebitReduction",
    description:
      "Reduction of the ownership registration fee when paid by Abbuchung und Einziehung (direct debit)",
    unit: "cents",
    value: 3_000,
    validFrom: "2026-08-01",
    legalBasis: "TP 9 Anm. 6 GGG idF BGBl. II Nr. 227/2026",
    sourceUrl: SOURCES.gggValorisation2026,
    verifiedOn: "2026-10-18",
    note: "€28 → €30 (Art. I Z 12b BGBl. II Nr. 227/2026). Applies to TP 9 lit. b Z 1 and Z 3.",
  },
];
