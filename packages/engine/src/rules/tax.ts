import { SOURCES } from "../citations.js";
import type { Rule, RuleId } from "./types.js";

const VERIFIED = "2026-10-18";
const COVERAGE = "2025-04-01";

// ---------------------------------------------------------------------------
// Depreciation (AfA) of let buildings, § 16 Abs. 1 Z 8 EStG 1988
// ---------------------------------------------------------------------------

const AFA_NOTE =
  "Checked in the versions valid 2025-12-24 to 2026-12-31 and from 2027-01-01 (same wording). " +
  "Earlier versions not checked; validFrom is the engine's coverage start.";

export const AFA_RULES: Rule[] = [
  {
    id: "at.estg.afa.buildingRate",
    description: "Annual depreciation (AfA) of a let building without proof of useful life",
    unit: "ppm",
    value: 15_000,
    validFrom: COVERAGE,
    legalBasis: "§ 16 Abs. 1 Z 8 lit. d EStG 1988",
    sourceUrl: SOURCES.estg16,
    verifiedOn: VERIFIED,
    note: AFA_NOTE,
  },
  {
    id: "at.estg.afa.firstYearMultiplier",
    description: "Accelerated AfA: at most this multiple of the normal rate in the first year (half-year rule not applied)",
    unit: "count",
    value: 3,
    validFrom: COVERAGE,
    legalBasis: "§ 16 Abs. 1 Z 8 lit. e EStG 1988",
    sourceUrl: SOURCES.estg16,
    verifiedOn: VERIFIED,
    note:
      `${AFA_NOTE} Applies to buildings acquired or produced after 30 June 2020 (transitional rule in § 124b EStG, ` +
      "not checked separately); every purchase in the engine's coverage period qualifies. § 7 Abs. 2 (half-year rule) does not apply.",
  },
  {
    id: "at.estg.afa.secondYearMultiplier",
    description: "Accelerated AfA: at most this multiple of the normal rate in the second year",
    unit: "count",
    value: 2,
    validFrom: COVERAGE,
    legalBasis: "§ 16 Abs. 1 Z 8 lit. e EStG 1988",
    sourceUrl: SOURCES.estg16,
    verifiedOn: VERIFIED,
    note: AFA_NOTE,
  },
];

// ---------------------------------------------------------------------------
// Land share that cannot be depreciated, Grundanteilverordnung 2016
// ---------------------------------------------------------------------------

const GRUNDANTEIL_NOTE =
  "GrundanteilV 2016 (BGBl. II Nr. 99/2016, no amendments), issued under § 16 Abs. 1 Z 8 lit. d EStG; applies from tax year 2016. " +
  "Inhabitants: latest census published before the year in which AfA is first claimed (§ 2 Abs. 3). Land price: average for building land " +
  "zoned and fully serviced (baureifes Land). Each started 400 m² of business floor space counts as one unit (§ 2 Abs. 2). " +
  "Does not apply if another share is proven, e.g. by an expert opinion, or if the actual share differs by at least 50% (§ 3).";

const grundanteil = (id: RuleId, description: string, unit: "ppm" | "cents" | "count", value: number, legalBasis: string): Rule => ({
  id,
  description,
  unit,
  value,
  validFrom: "2016-01-01",
  legalBasis,
  sourceUrl: SOURCES.grundanteilV,
  verifiedOn: VERIFIED,
  note: GRUNDANTEIL_NOTE,
});

export const GRUNDANTEIL_RULES: Rule[] = [
  grundanteil(
    "at.grundanteil.smallTownPct",
    "Land share in municipalities under 100,000 inhabitants with average building-land price under €400/m²",
    "ppm",
    200_000,
    "§ 2 Abs. 1 GrundanteilV 2016",
  ),
  grundanteil(
    "at.grundanteil.largeBuildingPct",
    "Land share elsewhere, for buildings with more than 10 residential or business units",
    "ppm",
    300_000,
    "§ 2 Abs. 2 GrundanteilV 2016",
  ),
  grundanteil(
    "at.grundanteil.standardPct",
    "Land share elsewhere, for buildings with up to 10 units",
    "ppm",
    400_000,
    "§ 2 Abs. 2 GrundanteilV 2016",
  ),
  grundanteil("at.grundanteil.inhabitantsLimit", "Inhabitant threshold for the 20% land share", "count", 100_000, "§ 2 Abs. 1 and 2 GrundanteilV 2016"),
  grundanteil("at.grundanteil.landPriceLimitPerM2", "Average building-land price threshold for the 20% land share, per m²", "cents", 40_000, "§ 2 Abs. 1 and 2 GrundanteilV 2016"),
  grundanteil("at.grundanteil.unitsLimit", "Units above which the 30% land share applies", "count", 10, "§ 2 Abs. 2 GrundanteilV 2016"),
];

// ---------------------------------------------------------------------------
// Liebhaberei: horizon for a total surplus, Liebhabereiverordnung 1993
// ---------------------------------------------------------------------------

export const LVO_RULES: Rule[] = [
  {
    id: "at.lvo.smallLettingYears",
    description:
      "Letting of Eigentumswohnungen and Eigenheime: a total surplus must be expected within this many years from the start of letting",
    unit: "count",
    value: 25,
    validFrom: COVERAGE,
    legalBasis: "§ 2 Abs. 4 iVm § 1 Abs. 2 Z 3 LVO",
    sourceUrl: SOURCES.lvo,
    verifiedOn: VERIFIED,
    note: "At most 28 years from the first expenses. Checked in the version current on 2026-10-18; earlier versions not checked.",
  },
];

// ---------------------------------------------------------------------------
// Income tax tariff, § 33 Abs. 1 EStG 1988 (bracket limits are valorised each year)
// ---------------------------------------------------------------------------

const TARIFF_YEARS: { year: number; limits: [number, number, number, number, number]; legalBasis: string; note: string }[] = [
  {
    year: 2025,
    limits: [13_308, 21_617, 35_836, 69_166, 103_072],
    legalBasis: "§ 33 Abs. 1 EStG 1988 (amounts for 2025)",
    note: "Checked in the version valid 2025-07-01 to 2025-12-23 (BGBl. I Nr. 25/2025).",
  },
  {
    year: 2026,
    limits: [13_539, 21_992, 36_458, 70_365, 104_859],
    legalBasis: "§ 33 Abs. 1 EStG 1988 (amounts for 2026)",
    note: "Checked in the versions valid from 2026-01-01 (BGBl. I Nr. 97/2025) and from 2026-07-30 (BGBl. I Nr. 62/2026).",
  },
  {
    year: 2027,
    limits: [13_846, 22_491, 37_285, 71_960, 107_236],
    legalBasis: "§ 33 Abs. 1 EStG 1988 (amounts for 2027)",
    note: "From the footnotes 'für 2027' in the version valid from 2026-07-30 (BGBl. I Nr. 62/2026).",
  },
];

const LIMIT_IDS = [
  "at.estg.tariff.limit1",
  "at.estg.tariff.limit2",
  "at.estg.tariff.limit3",
  "at.estg.tariff.limit4",
  "at.estg.tariff.limit5",
] as const;

const RATES: [RuleId, number][] = [
  ["at.estg.tariff.rate1", 0],
  ["at.estg.tariff.rate2", 200_000],
  ["at.estg.tariff.rate3", 300_000],
  ["at.estg.tariff.rate4", 400_000],
  ["at.estg.tariff.rate5", 480_000],
  ["at.estg.tariff.rate6", 500_000],
];

export const TARIFF_RULES: Rule[] = [
  ...TARIFF_YEARS.flatMap(({ year, limits, legalBasis, note }) =>
    limits.map(
      (euros, i): Rule => ({
        id: LIMIT_IDS[i] as RuleId,
        description: `Income tax bracket limit ${i + 1} (upper end of the ${i + 1}. bracket)`,
        unit: "cents",
        value: euros * 100,
        validFrom: `${year}-01-01`,
        validTo: `${year}-12-31`,
        legalBasis,
        sourceUrl: SOURCES.estg33,
        verifiedOn: VERIFIED,
        note,
      }),
    ),
  ),
  ...RATES.map(
    ([id, value], i): Rule => ({
      id,
      description: `Income tax rate of bracket ${i + 1}`,
      unit: "ppm",
      value,
      validFrom: COVERAGE,
      legalBasis: "§ 33 Abs. 1 EStG 1988",
      sourceUrl: SOURCES.estg33,
      verifiedOn: VERIFIED,
      note: "Rates 0/20/30/40/48/50% unchanged in the 2025, 2026 and 2027 versions.",
    }),
  ),
  {
    id: "at.estg.tariff.limit6",
    description: "Income above this amount is taxed at the top rate (calendar years 2016 to 2029)",
    unit: "cents",
    value: 100_000_000,
    validFrom: COVERAGE,
    validTo: "2029-12-31",
    legalBasis: "§ 33 Abs. 1 EStG 1988",
    sourceUrl: SOURCES.estg33,
    verifiedOn: VERIFIED,
  },
  {
    id: "at.estg.tariff.rate7",
    description: "Top income tax rate on income above €1 million (calendar years 2016 to 2029)",
    unit: "ppm",
    value: 550_000,
    validFrom: COVERAGE,
    validTo: "2029-12-31",
    legalBasis: "§ 33 Abs. 1 EStG 1988",
    sourceUrl: SOURCES.estg33,
    verifiedOn: VERIFIED,
  },
];

export const TAX_RULES: Rule[] = [...AFA_RULES, ...GRUNDANTEIL_RULES, ...LVO_RULES, ...TARIFF_RULES];
