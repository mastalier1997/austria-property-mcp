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
  {
    id: "at.mrg.angemessenPermitAfter",
    description:
      "Fully regulated flats in buildings newly built under a permit issued after this date may be let at the angemessener Hauptmietzins instead of the Richtwert",
    unit: "date",
    value: "1945-05-08",
    validFrom: "2025-04-01",
    legalBasis: "§ 16 Abs. 1 Z 2 MRG",
    sourceUrl: SOURCES.mrg16,
    verifiedOn: "2026-10-18",
    note:
      "Checked in the § 16 version in force since 2026-01-01 (BGBl. I Nr. 114/2025). Also covers units newly created by an extension, " +
      "addition or conversion under a permit issued after that date (not checked by the engine). Earlier versions not checked.",
  },
  {
    id: "at.mrg.angemessenMinAreaM2",
    description:
      "Flats of Ausstattungskategorie A or B with more than this many m² of usable floor area may be let at the angemessener Hauptmietzins",
    unit: "count",
    value: 130,
    validFrom: "2025-04-01",
    legalBasis: "§ 16 Abs. 1 Z 4 MRG",
    sourceUrl: SOURCES.mrg16,
    verifiedOn: "2026-10-18",
    note:
      "Value in m². Applies only if the landlord re-lets the flat within six months of the previous tenant leaving (one more year for improvement works). " +
      "Checked in the § 16 version in force since 2026-01-01; earlier versions not checked.",
  },
  {
    id: "at.mrg.fixedTermReduction",
    description: "The maximum Hauptmietzins is reduced by this share for a fixed-term lease",
    unit: "ppm",
    value: 250_000,
    validFrom: "2025-04-01",
    legalBasis: "§ 16 Abs. 7 MRG",
    sourceUrl: SOURCES.mrg16,
    verifiedOn: "2026-10-18",
    note:
      "Applies to the maximum rent under § 16 Abs. 1 to 6 for leases fixed-term under § 29 Abs. 1 Z 3. Checked in the version in force since 2026-01-01; earlier versions not checked.",
  },
];
