import { SOURCES } from "../citations.js";
import type { Rule } from "./types.js";

const NOTE =
  "Checked in the MRG version current on 2026-10-18. In the partial-application range (§ 1 Abs. 4) " +
  "only §§ 14, 16b, 29 to 36, 45, 46 and 49 apply, so the rent caps of § 16 do not. " +
  "Earlier versions were not checked; validFrom is set to the engine's coverage start.";

export const MRG_RULES: Rule[] = [
  {
    id: "at.mrg.condominiumPermitAfter",
    description:
      "Flats in Wohnungseigentum are only partly covered by the MRG (no rent caps) if the building permit was issued after this date",
    unit: "date",
    value: "1945-05-08",
    validFrom: "2025-04-01",
    legalBasis: "§ 1 Abs. 4 Z 3 MRG",
    sourceUrl: SOURCES.mrg1,
    verifiedOn: "2026-10-18",
    note: NOTE,
  },
  {
    id: "at.mrg.newBuildingPermitAfter",
    description:
      "Units in buildings newly built without public funds are only partly covered by the MRG (no rent caps) if the building permit was issued after this date",
    unit: "date",
    value: "1953-06-30",
    validFrom: "2025-04-01",
    legalBasis: "§ 1 Abs. 4 Z 1 MRG",
    sourceUrl: SOURCES.mrg1,
    verifiedOn: "2026-10-18",
    note: NOTE,
  },
  {
    id: "at.mrg.exclusionMaxUnits",
    description:
      "Buildings with at most this many separate flats or business premises are excluded from the MRG entirely",
    unit: "count",
    value: 2,
    validFrom: "2025-04-01",
    legalBasis: "§ 1 Abs. 2 Z 5 MRG",
    sourceUrl: SOURCES.mrg1,
    verifiedOn: "2026-10-18",
    note: `${NOTE} Rooms created later by an attic conversion do not count towards the limit.`,
  },
];
