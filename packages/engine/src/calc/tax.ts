import { METHOD_CITATIONS, type Citation } from "../citations.js";
import {
  applyRate,
  centsToEur,
  divRound,
  divRoundSigned,
  formatEur,
  formatPpm,
  PPM_PER_UNIT,
  type Cents,
  type Ppm,
} from "../money.js";
import type { RuleId } from "../rules/index.js";
import type {
  AfaResult,
  Flag,
  LandShareResult,
  LiebhabereiResult,
  LoanCostsResult,
  TaxResult,
  TaxYear,
} from "../types.js";
import type { AnnuitySchedule } from "./financing.js";
import type { Ownership } from "./rentRegulation.js";
import { cite, type RuleTracker } from "./ruleTracker.js";

/** Years shown in TaxResult.years. */
export const TAX_YEARS_SHOWN = 5;

/** "100,000": locale-independent, so output is deterministic. */
const formatCount = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ---------------------------------------------------------------------------
// Land share (Grundanteilverordnung 2016)
// ---------------------------------------------------------------------------

export interface LandShareFacts {
  /** Land share given by the caller, ppm. */
  inputPpm?: Ppm;
  municipalityInhabitants?: number;
  /** Average building-land price, cents per m². */
  landPriceCentsPerM2?: number;
  unitsInBuilding?: number;
}

export interface LandShare extends LandShareResult {
  ppm: Ppm;
}

/**
 * Land share of a let building. Without proof, § 2 GrundanteilV 2016 presumes
 * 20% in municipalities under 100,000 inhabitants with building land under
 * €400/m², and otherwise 30% (more than 10 units) or 40% (up to 10 units).
 * When facts are missing, the higher share applies, since the lower ones need
 * facts the caller has not given; factsComplete says so.
 */
export function landShare(facts: LandShareFacts, rules: RuleTracker): LandShare {
  if (facts.inputPpm !== undefined) {
    return {
      ppm: facts.inputPpm,
      pct: facts.inputPpm / 10_000,
      basis: "input",
      factsComplete: true,
      explanation: `Land share of ${formatPpm(facts.inputPpm)} as given (e.g. from an expert opinion, § 3 GrundanteilV 2016).`,
      ruleIds: [],
      citations: [],
    };
  }
  const inhabitantsLimit = rules.numeric("at.grundanteil.inhabitantsLimit");
  const priceLimit = rules.numeric("at.grundanteil.landPriceLimitPerM2");
  const { municipalityInhabitants: inhabitants, landPriceCentsPerM2: price, unitsInBuilding: units } = facts;
  const small =
    inhabitants !== undefined && inhabitants < inhabitantsLimit.value && price !== undefined && price < priceLimit.value;
  const large =
    (inhabitants !== undefined && inhabitants >= inhabitantsLimit.value) || (price !== undefined && price >= priceLimit.value);
  const thresholds = `${formatCount(inhabitantsLimit.value)} inhabitants, ${formatEur(priceLimit.value)}/m²`;

  if (small) {
    const rule = rules.numeric("at.grundanteil.smallTownPct");
    return {
      ppm: rule.value,
      pct: rule.value / 10_000,
      basis: "grundanteilV",
      factsComplete: true,
      explanation: `${formatPpm(rule.value)}: municipality under ${formatCount(inhabitantsLimit.value)} inhabitants with building land under ${formatEur(priceLimit.value)}/m².`,
      ruleIds: [rule.id, inhabitantsLimit.id, priceLimit.id],
      citations: [cite(rule)],
    };
  }

  const unitsLimit = rules.numeric("at.grundanteil.unitsLimit");
  const manyUnits = units !== undefined && units > unitsLimit.value;
  const rule = rules.numeric(manyUnits ? "at.grundanteil.largeBuildingPct" : "at.grundanteil.standardPct");
  const missing: string[] = [];
  if (!large) missing.push("tax.municipalityInhabitants and tax.averageLandPricePerM2 (20% in municipalities below both thresholds)");
  if (units === undefined) missing.push(`property.unitsInBuilding (30% for more than ${unitsLimit.value} units)`);
  const where = large
    ? `municipality with at least ${formatCount(inhabitantsLimit.value)} inhabitants or building land from ${formatEur(priceLimit.value)}/m²`
    : `municipality not shown to be below ${thresholds}`;
  const building = manyUnits
    ? `building with more than ${unitsLimit.value} units`
    : units === undefined
      ? `unit count unknown, so up to ${unitsLimit.value} units assumed`
      : `building with up to ${unitsLimit.value} units`;
  return {
    ppm: rule.value,
    pct: rule.value / 10_000,
    basis: "grundanteilV",
    factsComplete: missing.length === 0,
    explanation: `${formatPpm(rule.value)}: ${where}; ${building}.${missing.length > 0 ? ` To refine, pass ${missing.join(" and ")}.` : ""}`,
    ruleIds: [rule.id, inhabitantsLimit.id, priceLimit.id, unitsLimit.id],
    citations: [cite(rule)],
  };
}

// ---------------------------------------------------------------------------
// Income tax tariff (§ 33 Abs. 1 EStG)
// ---------------------------------------------------------------------------

export interface Tariff {
  year: number;
  /** Upper ends of brackets 1 to 6, cents. */
  limits: Cents[];
  /** Rates of brackets 1 to 7, ppm. */
  rates: Ppm[];
  ruleIds: RuleId[];
  citations: Citation[];
}

const LIMIT_IDS: RuleId[] = [
  "at.estg.tariff.limit1",
  "at.estg.tariff.limit2",
  "at.estg.tariff.limit3",
  "at.estg.tariff.limit4",
  "at.estg.tariff.limit5",
  "at.estg.tariff.limit6",
];
const RATE_IDS: RuleId[] = [
  "at.estg.tariff.rate1",
  "at.estg.tariff.rate2",
  "at.estg.tariff.rate3",
  "at.estg.tariff.rate4",
  "at.estg.tariff.rate5",
  "at.estg.tariff.rate6",
  "at.estg.tariff.rate7",
];

/** The § 33 tariff valid on the tracker's valuation date. */
export function tariffFor(rules: RuleTracker): Tariff {
  const limitRules = LIMIT_IDS.map((id) => rules.numeric(id));
  const rateRules = RATE_IDS.map((id) => rules.numeric(id));
  return {
    year: Number(rules.valuationDate.slice(0, 4)),
    limits: limitRules.map((r) => r.value),
    rates: rateRules.map((r) => r.value),
    ruleIds: [...LIMIT_IDS, ...RATE_IDS],
    citations: [cite(limitRules[0]!)],
  };
}

/**
 * Income tax on a yearly taxable income under the § 33 Abs. 1 tariff, before
 * tax credits (Absetzbeträge). Computed exactly, rounded half up to the cent
 * (§ 204 BAO). Zero for incomes of zero or less.
 */
export function incomeTax(incomeCents: Cents, tariff: Tariff): Cents {
  if (incomeCents <= 0) return 0;
  const income = BigInt(incomeCents);
  let lower = 0n;
  let sum = 0n;
  for (let i = 0; i < tariff.rates.length; i++) {
    const upper = i < tariff.limits.length ? BigInt(tariff.limits[i]!) : income;
    const top = income < upper ? income : upper;
    if (top > lower) sum += (top - lower) * BigInt(tariff.rates[i]!);
    if (income <= upper) break;
    lower = upper;
  }
  return Number(divRound(sum, BigInt(PPM_PER_UNIT), "halfUp"));
}

/** Rate that applies to the next euro above the given income, ppm. */
export function bracketRate(incomeCents: Cents, tariff: Tariff): Ppm {
  const index = tariff.limits.findIndex((limit) => incomeCents < limit);
  return tariff.rates[index === -1 ? tariff.rates.length - 1 : index]!;
}

// ---------------------------------------------------------------------------
// Rental result, tax and after-tax cash flow by year
// ---------------------------------------------------------------------------

export interface TaxCalculationInput {
  rules: RuleTracker;
  ownership: Ownership | undefined;
  unitsInBuilding: number | undefined;
  buildingYear: number | undefined;
  /** Price plus acquisition costs. */
  totalInvestmentCents: Cents;
  /** Mortgage registration fee included in the acquisition costs (0 without a loan). */
  mortgageFeeCents: Cents;
  schedule: AnnuitySchedule | null;
  termYears: number;
  /** Monthly amounts from the operating lines. */
  monthly: {
    rentCents: Cents;
    vacancyCents: Cents;
    managementCents: Cents;
    maintenanceCents: Cents;
    reserveCents: Cents;
    noiCents: Cents;
  };
  landShare: LandShareFacts;
  otherIncomeCents: Cents | undefined;
  marginalRatePpm: Ppm;
  marginalRateDefaulted: boolean;
}

export interface TaxCalculation {
  tax: TaxResult;
  flags: Flag[];
}

/** Years 2024 to 2026: completion years for which a higher temporary AfA may apply (not modelled). */
const NEW_BUILD_YEARS = { from: 2024, to: 2026 };

export function rentalTax(input: TaxCalculationInput): TaxCalculation {
  const { rules, monthly } = input;
  const flags: Flag[] = [];

  // AfA basis
  const land = landShare(input.landShare, rules);
  const costBasis = input.totalInvestmentCents - input.mortgageFeeCents;
  const landCents = applyRate(costBasis, land.ppm, "halfUp");
  const building = costBasis - landCents;
  const rate = rules.numeric("at.estg.afa.buildingRate");
  const first = rules.numeric("at.estg.afa.firstYearMultiplier");
  const second = rules.numeric("at.estg.afa.secondYearMultiplier");
  const afaRatePpm = (year: number): Ppm => rate.value * (year === 1 ? first.value : year === 2 ? second.value : 1);
  const afa: AfaResult = {
    costBasisCents: costBasis,
    landShareCents: landCents,
    buildingCents: building,
    year1Pct: afaRatePpm(1) / 10_000,
    year2Pct: afaRatePpm(2) / 10_000,
    fromYear3Pct: afaRatePpm(3) / 10_000,
    calculation:
      `(${formatEur(input.totalInvestmentCents)} price and acquisition costs` +
      (input.mortgageFeeCents > 0 ? ` − ${formatEur(input.mortgageFeeCents)} mortgage registration fee` : "") +
      `) × (100% − ${formatPpm(land.ppm)} land) = ${formatEur(building)}; AfA ${formatPpm(afaRatePpm(1))} in year 1, ` +
      `${formatPpm(afaRatePpm(2))} in year 2, then ${formatPpm(rate.value)}, each rounded to the cent`,
    ruleIds: [rate.id, first.id, second.id, ...land.ruleIds],
    citations: [cite(rate), cite(first), ...land.citations],
  };

  // Mortgage registration fee: a cost of borrowing, spread over the loan term
  let loanCosts: LoanCostsResult | null = null;
  const loanCostByYear = (year: number): Cents => {
    if (loanCosts === null) return 0;
    const { totalCents, spreadYears } = loanCosts;
    if (year > spreadYears) return 0;
    const base = Math.floor(totalCents / spreadYears);
    return year === 1 ? totalCents - base * (spreadYears - 1) : base;
  };
  if (input.mortgageFeeCents > 0) {
    const spreadYears = input.termYears <= 2 ? 1 : input.termYears;
    loanCosts = {
      totalCents: input.mortgageFeeCents,
      spreadYears,
      calculation:
        spreadYears === 1
          ? `${formatEur(input.mortgageFeeCents)} deducted in year 1: the loan covers only the current and the following year`
          : `${formatEur(input.mortgageFeeCents)} ÷ ${spreadYears} years (loan term); year 1 takes the rounding remainder`,
      citations: [METHOD_CITATIONS.loanCostsSpread],
    };
  }

  // Tax method
  const tariff = input.otherIncomeCents !== undefined ? tariffFor(rules) : null;
  const other = input.otherIncomeCents ?? 0;
  const otherTax = tariff ? incomeTax(other, tariff) : 0;
  const taxOn = (result: Cents): Cents =>
    tariff
      ? incomeTax(other + result, tariff) - otherTax
      : Number(divRoundSigned(BigInt(result) * BigInt(input.marginalRatePpm), BigInt(PPM_PER_UNIT)));
  const marginalRatePpm = tariff ? bracketRate(other, tariff) : input.marginalRatePpm;

  // Liebhaberei horizon (§ 1 Abs. 2 Z 3 LVO: condominiums and houses)
  const checkLiebhaberei = input.ownership !== "wholeBuilding";
  const horizon = checkLiebhaberei ? rules.numeric("at.lvo.smallLettingYears") : null;
  const yearsToProject = Math.max(TAX_YEARS_SHOWN, horizon?.value ?? 0);

  const netRent = 12 * (monthly.rentCents - monthly.vacancyCents);
  const costs = 12 * (monthly.managementCents + monthly.maintenanceCents);
  const reserve = 12 * monthly.reserveCents;
  const years: TaxYear[] = [];
  let afaTaken = 0;
  for (let year = 1; year <= yearsToProject; year++) {
    const interest = input.schedule?.interestByYearCents[year - 1] ?? 0;
    const payments = input.schedule?.paymentByYearCents[year - 1] ?? 0;
    const afaCents = Math.min(applyRate(building, afaRatePpm(year), "halfUp"), building - afaTaken);
    afaTaken += afaCents;
    const loanCostsCents = loanCostByYear(year);
    const result = netRent - interest - afaCents - costs - loanCostsCents;
    const taxCents = taxOn(result);
    const cashFlow = 12 * monthly.noiCents - payments;
    years.push({
      year,
      netRentalIncomeCents: netRent,
      interestCents: interest,
      afaCents,
      operatingCostsCents: costs,
      loanCostsCents,
      reserveNotDeductedCents: reserve,
      resultCents: result,
      taxCents,
      cashFlowBeforeTaxCents: cashFlow,
      cashFlowAfterTaxCents: cashFlow - taxCents,
    });
  }

  // Liebhaberei
  let liebhaberei: LiebhabereiResult;
  if (horizon === null) {
    liebhaberei = {
      status: "notChecked",
      horizonYears: null,
      cumulativeResultCents: null,
      totalSurplusFromYear: null,
      resultByYearCents: [],
      explanation:
        "Not checked: letting a whole building falls under § 1 Abs. 1 LVO, where income is presumed unless the circumstances show otherwise.",
      ruleIds: [],
      citations: [],
    };
  } else {
    const resultByYear = years.slice(0, horizon.value).map((y) => y.resultCents - reserve);
    let cumulative = 0;
    let lastNotPositive = 0;
    resultByYear.forEach((result, i) => {
      cumulative += result;
      if (cumulative <= 0) lastNotPositive = i + 1;
    });
    const surplus = cumulative > 0;
    const fromYear = surplus ? lastNotPositive + 1 : null;
    liebhaberei = {
      status: surplus ? "totalSurplus" : "noTotalSurplus",
      horizonYears: horizon.value,
      cumulativeResultCents: cumulative,
      totalSurplusFromYear: fromYear,
      resultByYearCents: resultByYear,
      explanation: surplus
        ? `Cumulative result over ${horizon.value} years: ${formatEur(cumulative)}, positive from year ${fromYear}. ` +
          `A total surplus within ${horizon.value} years rules out Liebhaberei (§ 2 Abs. 4 LVO), so losses in early years count for tax.`
        : `Cumulative result over ${horizon.value} years: ${formatEur(cumulative)}. Losses from letting a condominium or house are presumed ` +
          `Liebhaberei unless a total surplus is expected within ${horizon.value} years (§ 1 Abs. 2 Z 3, § 2 Abs. 4 LVO); then the losses would not reduce tax.`,
      ruleIds: [horizon.id],
      citations: [cite(horizon), METHOD_CITATIONS.reserveDeduction],
    };
    if (!surplus) {
      flags.push({
        id: "tax.liebhabereiRisk",
        severity: "warn",
        message:
          `No total surplus within ${horizon.value} years under these assumptions (cumulative result ${formatEur(cumulative)}), so the tax office may treat the letting as Liebhaberei: ` +
          "losses would not reduce tax and the after-tax figures would not hold. More equity, a higher rent or a shorter loan improve the result. The projection keeps rents constant.",
        citations: [cite(horizon)],
      });
    }
  }

  // Flags on assumptions
  if (!tariff && input.marginalRateDefaulted) {
    flags.push({
      id: "assumption.taxRate",
      severity: "info",
      message: `Income tax estimated at a flat ${formatPpm(input.marginalRatePpm)} of the rental result (default marginal rate). Pass tax.otherTaxableIncome for the exact § 33 tariff, or set assumptions.marginalTaxRatePct.`,
      citations: [],
    });
  }
  if (!land.factsComplete) {
    flags.push({
      id: "assumption.landShare",
      severity: "info",
      message: `Land share for AfA assumed at ${formatPpm(land.ppm)} (GrundanteilV 2016): ${land.explanation.replace(/^[^:]*: /, "")}`,
      citations: land.citations,
    });
  }
  if (input.buildingYear !== undefined && input.buildingYear >= NEW_BUILD_YEARS.from && input.buildingYear <= NEW_BUILD_YEARS.to) {
    flags.push({
      id: "tax.newBuildAfaNotModelled",
      severity: "info",
      message:
        `Residential buildings completed in ${NEW_BUILD_YEARS.from} to ${NEW_BUILD_YEARS.to} can qualify for a temporarily higher accelerated AfA if they meet an ecological standard. ` +
        "This is not modelled; the engine uses the standard rates. Check with a tax adviser.",
      citations: [],
    });
  }

  const year1 = years[0]!;
  const monthlyAfterTax = Number(divRoundSigned(BigInt(year1.cashFlowAfterTaxCents), 12n));
  const calculation = tariff
    ? `Tax = § 33 tariff ${tariff.year} on (${formatEur(other)} other income + rental result) − tariff on the other income alone, each rounded to the cent; the same tariff for every year.`
    : `Tax = rental result × ${formatPpm(input.marginalRatePpm)} (flat marginal rate), rounded to the cent; a loss saves tax on other income at the same rate.`;

  return {
    tax: {
      method: tariff ? "tariff" : "marginalRate",
      marginalRatePct: marginalRatePpm / 10_000,
      otherTaxableIncomeCents: input.otherIncomeCents ?? null,
      tariffYear: tariff?.year ?? null,
      landShare: {
        pct: land.pct,
        basis: land.basis,
        factsComplete: land.factsComplete,
        explanation: land.explanation,
        ruleIds: land.ruleIds,
        citations: land.citations,
      },
      afa,
      loanCosts,
      years: years.slice(0, TAX_YEARS_SHOWN),
      monthlyCashFlowAfterTaxYear1Cents: monthlyAfterTax,
      monthlyCashFlowAfterTaxYear1: centsToEur(monthlyAfterTax),
      liebhaberei,
      calculation,
      citations: tariff ? tariff.citations : [],
    },
    flags,
  };
}
