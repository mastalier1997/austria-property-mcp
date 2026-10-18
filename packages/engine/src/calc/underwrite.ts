import {
  ACQUISITION_ASSUMPTIONS,
  defaultOperatingAssumptions,
  OPERATING_ASSUMPTIONS,
  type AcquisitionAssumptions,
  type OperatingAssumptionId,
  type OperatingAssumptions,
} from "../assumptions.js";
import { isIsoDate } from "../dates.js";
import {
  applyRate,
  centsToEur,
  divRound,
  eurToCents,
  formatEur,
  formatPpm,
  percent,
  pctToPpm,
  PPM_PER_UNIT,
  ratio,
  type Cents,
  type Ppm,
} from "../money.js";
import type {
  Flag,
  FinancingResult,
  OperatingLine,
  UnderwriteAssumptionId,
  UnderwriteInput,
  UnderwriteMetrics,
  UnderwriteResult,
} from "../types.js";
import { ENGINE_VERSION } from "../version.js";
import { acquisitionCosts, DISCLAIMER, InputError, LIMITATIONS, type InputIssue } from "./acquisitionCosts.js";
import { annuitySchedule, type AnnuitySchedule } from "./financing.js";
import { classifyRentRegulation, type Ownership } from "./rentRegulation.js";
import { cite, RuleTracker } from "./ruleTracker.js";
import { rentalTax } from "./tax.js";

/** Risk-flag thresholds. Rules of thumb, not law; documented in docs/rules.md. */
export const HEURISTICS = Object.freeze({
  /** Warn above this loan-to-value, % of the purchase price. */
  highLtvPct: 80,
  /** Flag as high severity above this loan-to-value. */
  veryHighLtvPct: 100,
  /** Warn when NOI covers the loan payment less than this many times (but at least once). */
  thinDscr: 1.2,
});

export const UNDERWRITE_LIMITATIONS: readonly string[] = Object.freeze([
  ...LIMITATIONS,
  "Metrics and the cash-flow flags are before income tax; the tax section adds the after-tax view.",
  "Income tax: the rental result is taxed at a flat marginal rate, or with the § 33 tariff of the valuation year when other taxable income is given. Tax credits (Absetzbeträge), other deductions and changes to the tariff in later years are ignored. Losses are offset only against other income of the same year.",
  "Tax years are treated as loan years, and year 1 has a full year of rent. AfA takes the accelerated rates in full (§ 16 Abs. 1 Z 8 lit. e EStG); the land share follows the GrundanteilV 2016 unless given. VAT on acquisition costs stays in the AfA base, as for a landlord using the small-business exemption.",
  "Repair-reserve contributions are deductible only when the reserve is spent. The yearly tax leaves them out; the Liebhaberei projection assumes they are spent and deducted within the horizon.",
  "The mortgage registration fee is treated as a cost of borrowing and spread over the loan term (§ 19 Abs. 3 EStG); all other acquisition costs go into the AfA base.",
  "Rent, costs and the interest rate are held constant; no indexation, rent increases or rate resets after a fixed period.",
  "Rent inputs are taken as net of VAT; VAT on rent is not modelled.",
  "The minimum repair reserve is applied to the flat's own floor area; actual shares follow the co-ownership ratio.",
  "The rent-regulation check covers only building size and permit dates (§ 1 Abs. 2 Z 5, Abs. 4 Z 1 and Z 3 MRG). Attic conversions, extensions and other special cases are not checked, and Richtwert levels are not computed.",
]);

const OWNERSHIPS: readonly Ownership[] = ["condominium", "house", "wholeBuilding"];
const MAX_RATE_PPM = 200_000; // 20%
const MAX_TERM_YEARS = 50;

interface Normalised {
  rentCents: Cents;
  operatingCostsCents: Cents;
  areaHundredths: number | undefined;
  reserveCents: Cents | undefined;
  maintenanceCents: Cents | undefined;
  loan: { ratePpm: Ppm; ratePct: number; termYears: number } | undefined;
  operating: OperatingAssumptions;
  operatingDefaulted: OperatingAssumptionId[];
  acquisitionAssumptions: Partial<AcquisitionAssumptions>;
  tax: {
    otherIncomeCents?: Cents;
    landSharePpm?: Ppm;
    inhabitants?: number;
    landPriceCents?: Cents;
  };
}

const TAX_KEYS = ["otherTaxableIncome", "landSharePct", "municipalityInhabitants", "averageLandPricePerM2"];

function normalise(input: UnderwriteInput, issues: InputIssue[]): Normalised {
  const amount = (path: string, value: unknown, allowZero: boolean): Cents => {
    const cents = typeof value === "number" ? eurToCents(value) : undefined;
    if (cents === undefined) {
      issues.push({ path, message: "must be a number in EUR with at most two decimals" });
      return 0;
    }
    if (cents < 0 || (!allowZero && cents === 0)) {
      issues.push({ path, message: allowZero ? "must not be negative" : "must be greater than 0" });
    }
    return cents;
  };

  // Rent
  let rentCents = 0;
  let operatingCostsCents = 0;
  if (typeof input.rent !== "object" || input.rent === null) {
    issues.push({ path: "rent", message: "must be an object with netColdMonthly" });
  } else {
    rentCents = amount("rent.netColdMonthly", input.rent.netColdMonthly, false);
    if (input.rent.operatingCostsMonthly !== undefined) {
      operatingCostsCents = amount("rent.operatingCostsMonthly", input.rent.operatingCostsMonthly, true);
    }
  }

  // Property
  let areaHundredths: number | undefined;
  const p = input.property ?? {};
  if (typeof p !== "object" || p === null) {
    issues.push({ path: "property", message: "must be an object or omitted" });
  } else {
    if (p.livingAreaM2 !== undefined) {
      const hundredths = typeof p.livingAreaM2 === "number" ? eurToCents(p.livingAreaM2) : undefined;
      if (hundredths === undefined || hundredths <= 0 || hundredths > 10_000_00) {
        issues.push({ path: "property.livingAreaM2", message: "must be between 0 and 10,000 m² with at most two decimals" });
      } else {
        areaHundredths = hundredths;
      }
    }
    if (p.ownership !== undefined && !OWNERSHIPS.includes(p.ownership)) {
      issues.push({ path: "property.ownership", message: `must be one of ${OWNERSHIPS.join(", ")}` });
    }
    if (p.buildingPermitDate !== undefined && !isIsoDate(p.buildingPermitDate)) {
      issues.push({ path: "property.buildingPermitDate", message: "must be a date in YYYY-MM-DD form" });
    }
    if (p.buildingYear !== undefined && (!Number.isInteger(p.buildingYear) || p.buildingYear < 1500 || p.buildingYear > 2100)) {
      issues.push({ path: "property.buildingYear", message: "must be a whole year between 1500 and 2100" });
    }
    if (p.publicFunding !== undefined && typeof p.publicFunding !== "boolean") {
      issues.push({ path: "property.publicFunding", message: "must be true, false or omitted" });
    }
    if (p.unitsInBuilding !== undefined && (!Number.isInteger(p.unitsInBuilding) || p.unitsInBuilding < 1)) {
      issues.push({ path: "property.unitsInBuilding", message: "must be a whole number of at least 1" });
    }
  }

  // Owner costs
  let reserveCents: Cents | undefined;
  let maintenanceCents: Cents | undefined;
  if (input.ownerCosts !== undefined) {
    if (typeof input.ownerCosts !== "object" || input.ownerCosts === null) {
      issues.push({ path: "ownerCosts", message: "must be an object or omitted" });
    } else {
      if (input.ownerCosts.reserveFundMonthly !== undefined) {
        reserveCents = amount("ownerCosts.reserveFundMonthly", input.ownerCosts.reserveFundMonthly, true);
      }
      if (input.ownerCosts.maintenanceMonthly !== undefined) {
        maintenanceCents = amount("ownerCosts.maintenanceMonthly", input.ownerCosts.maintenanceMonthly, true);
      }
    }
  }

  // Loan terms (the loan amount itself is validated by acquisitionCosts)
  let loan: Normalised["loan"];
  const f = input.financing;
  if (f !== undefined && typeof f === "object" && f !== null && typeof f.loanAmount === "number" && f.loanAmount > 0) {
    const ratePpm = typeof f.ratePct === "number" ? pctToPpm(f.ratePct) : undefined;
    if (ratePpm === undefined || ratePpm < 0 || ratePpm > MAX_RATE_PPM) {
      issues.push({ path: "financing.ratePct", message: "must be an annual rate between 0 and 20 (%), at most four decimals" });
    }
    const termOk = Number.isInteger(f.termYears) && f.termYears >= 1 && f.termYears <= MAX_TERM_YEARS;
    if (!termOk) issues.push({ path: "financing.termYears", message: `must be a whole number of years from 1 to ${MAX_TERM_YEARS}` });
    if (ratePpm !== undefined && termOk) loan = { ratePpm, ratePct: f.ratePct, termYears: f.termYears };
  }

  // Tax facts
  const tax: Normalised["tax"] = {};
  if (input.tax !== undefined) {
    if (typeof input.tax !== "object" || input.tax === null) {
      issues.push({ path: "tax", message: "must be an object or omitted" });
    } else {
      const t = input.tax as Record<string, unknown>;
      for (const key of Object.keys(t)) {
        if (!TAX_KEYS.includes(key)) issues.push({ path: `tax.${key}`, message: `unknown field; expected one of ${TAX_KEYS.join(", ")}` });
      }
      if (t.otherTaxableIncome !== undefined) tax.otherIncomeCents = amount("tax.otherTaxableIncome", t.otherTaxableIncome, true);
      if (t.landSharePct !== undefined) {
        const ppm = typeof t.landSharePct === "number" ? pctToPpm(t.landSharePct) : undefined;
        if (ppm === undefined || ppm < 0 || ppm > PPM_PER_UNIT) {
          issues.push({ path: "tax.landSharePct", message: "must be a percentage from 0 to 100 with at most four decimals" });
        } else {
          tax.landSharePpm = ppm;
        }
      }
      if (t.municipalityInhabitants !== undefined) {
        const v = t.municipalityInhabitants;
        if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
          issues.push({ path: "tax.municipalityInhabitants", message: "must be a whole number of at least 0" });
        } else {
          tax.inhabitants = v;
        }
      }
      if (t.averageLandPricePerM2 !== undefined) tax.landPriceCents = amount("tax.averageLandPricePerM2", t.averageLandPricePerM2, true);
    }
  }

  // Assumptions: split into acquisition and operating
  const operating = defaultOperatingAssumptions();
  const operatingDefaulted: OperatingAssumptionId[] = [];
  const acquisitionAssumptions: Record<string, unknown> = {};
  const given = (input.assumptions ?? {}) as Record<string, unknown>;
  if (typeof given !== "object" || given === null) {
    issues.push({ path: "assumptions", message: "must be an object or omitted" });
  } else {
    for (const [key, value] of Object.entries(given)) {
      if (key in ACQUISITION_ASSUMPTIONS) acquisitionAssumptions[key] = value;
      else if (!(key in OPERATING_ASSUMPTIONS)) issues.push({ path: `assumptions.${key}`, message: "unknown assumption" });
    }
    for (const id of Object.keys(OPERATING_ASSUMPTIONS) as OperatingAssumptionId[]) {
      const value = given[id];
      if (value === undefined) {
        operatingDefaulted.push(id);
        continue;
      }
      const def = OPERATING_ASSUMPTIONS[id];
      if (typeof value !== "number" || !Number.isFinite(value) || value < (def.min ?? 0) || value > (def.max ?? Infinity) || pctToPpm(value) === undefined) {
        issues.push({ path: `assumptions.${id}`, message: `must be a number between ${def.min} and ${def.max} with at most four decimals` });
        continue;
      }
      operating[id] = value;
    }
    if (pctToPpm(operating.vacancyPct)! + pctToPpm(operating.managementPct)! >= PPM_PER_UNIT) {
      issues.push({ path: "assumptions", message: "vacancyPct plus managementPct must stay below 100" });
    }
  }

  return {
    rentCents,
    operatingCostsCents,
    areaHundredths,
    reserveCents,
    maintenanceCents,
    loan,
    operating,
    operatingDefaulted,
    acquisitionAssumptions: acquisitionAssumptions as Partial<AcquisitionAssumptions>,
    tax,
  };
}

/**
 * Underwrites an Austrian residential buy-to-let purchase: acquisition costs,
 * loan payment, monthly cash flow, yields, break-even rent, a rent-regulation
 * check, income tax on the rental result with a Liebhaberei check, and risk flags.
 *
 * Pure and deterministic. Throws InputError (listing every problem) for
 * malformed input and RuleNotCoveredError outside the covered dates.
 */
export function underwrite(input: UnderwriteInput): UnderwriteResult {
  if (typeof input !== "object" || input === null) {
    throw new InputError([{ path: "", message: "input must be an object" }]);
  }
  const issues: InputIssue[] = [];
  const n = normalise(input, issues);

  let acquisition: ReturnType<typeof acquisitionCosts> | undefined;
  try {
    const financing = input.financing;
    acquisition = acquisitionCosts({
      valuationDate: input.valuationDate,
      purchasePrice: input.purchasePrice,
      broker: input.broker,
      ...(financing === undefined
        ? {}
        : {
            financing:
              typeof financing === "object" && financing !== null
                ? {
                    loanAmount: financing.loanAmount,
                    ...(financing.registeredMortgageAmount === undefined
                      ? {}
                      : { registeredMortgageAmount: financing.registeredMortgageAmount }),
                  }
                : financing,
          }),
      assumptions: n.acquisitionAssumptions,
    });
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    issues.unshift(...error.issues);
  }
  if (issues.length > 0 || acquisition === undefined) throw new InputError(issues);

  const date = acquisition.valuationDate;
  const priceCents = acquisition.purchasePriceCents;
  const rules = new RuleTracker(date);
  rules.addUsed(acquisition.rulesUsed);
  const flags: Flag[] = [...acquisition.flags];
  const operating: OperatingLine[] = [];
  const line = (l: Omit<OperatingLine, "amount">): Cents => {
    operating.push({ ...l, amount: centsToEur(l.amountCents) });
    return l.amountCents;
  };

  const totalInvestmentCents = priceCents + acquisition.totalCents;
  const loanCents = input.financing && n.loan ? (eurToCents(input.financing.loanAmount) as Cents) : 0;

  // Financing
  let financing: FinancingResult | null = null;
  let schedule: AnnuitySchedule | null = null;
  if (n.loan && loanCents > 0) {
    schedule = annuitySchedule(loanCents, n.loan.ratePpm, n.loan.termYears * 12);
    financing = {
      loanCents,
      ratePct: n.loan.ratePct,
      termYears: n.loan.termYears,
      monthlyPaymentCents: schedule.monthlyPaymentCents,
      monthlyPayment: centsToEur(schedule.monthlyPaymentCents),
      year1InterestCents: schedule.year1InterestCents,
      year1PrincipalCents: schedule.year1PrincipalCents,
      balanceAfterYear1Cents: schedule.balanceAfterYear1Cents,
      totalInterestCents: schedule.totalInterestCents,
      ltvPct: percent(loanCents, priceCents),
      calculation: `Annuity of ${formatEur(loanCents)} at ${formatPpm(n.loan.ratePpm)} p.a. over ${n.loan.termYears} years, monthly payments, interest rounded to the cent each month`,
    };
  }
  const paymentCents = financing?.monthlyPaymentCents ?? 0;

  // Operating income and costs (monthly)
  const { vacancyPct, managementPct, maintenancePctPerYear } = n.operating;
  const vacancyPpm = pctToPpm(vacancyPct) as Ppm;
  const managementPpm = pctToPpm(managementPct) as Ppm;
  const maintenancePpm = pctToPpm(maintenancePctPerYear) as Ppm;
  const rentCents = line({
    id: "rent",
    kind: "income",
    labelDe: "Nettomiete (Hauptmietzins)",
    labelEn: "Net cold rent",
    amountCents: n.rentCents,
    calculation: "Input",
    ruleIds: [],
    assumptionIds: [],
    citations: [],
  });

  const grossRent = n.rentCents + n.operatingCostsCents;
  const vacancyCents = line({
    id: "vacancy",
    kind: "cost",
    labelDe: "Leerstand und Mietausfall",
    labelEn: "Vacancy and rent loss",
    amountCents: applyRate(grossRent, vacancyPpm, "halfUp"),
    calculation:
      n.operatingCostsCents > 0
        ? `${formatPpm(vacancyPpm)} × ${formatEur(grossRent)} (rent plus operating costs the owner carries while empty)`
        : `${formatPpm(vacancyPpm)} × ${formatEur(n.rentCents)}`,
    ruleIds: [],
    assumptionIds: ["vacancyPct"],
    citations: [],
  });

  const managementCents =
    managementPpm > 0
      ? line({
          id: "management",
          kind: "cost",
          labelDe: "Verwaltung",
          labelEn: "Management",
          amountCents: applyRate(n.rentCents, managementPpm, "halfUp"),
          calculation: `${formatPpm(managementPpm)} × ${formatEur(n.rentCents)}`,
          ruleIds: [],
          assumptionIds: ["managementPct"],
          citations: [],
        })
      : 0;

  // Repair reserve: input, else the statutory minimum for a condominium
  const ownership = input.property?.ownership;
  const weg = ownership === undefined || ownership === "condominium";
  let reserveCents = 0;
  if (n.reserveCents !== undefined) {
    reserveCents = line({
      id: "reserveFund",
      kind: "cost",
      labelDe: "Reparaturrücklage",
      labelEn: "Repair reserve contribution",
      amountCents: n.reserveCents,
      calculation: "Input",
      ruleIds: [],
      assumptionIds: [],
      citations: [],
    });
  } else if (weg && n.areaHundredths !== undefined) {
    const minimum = rules.numeric("at.weg.minReservePerM2");
    reserveCents = line({
      id: "reserveFund",
      kind: "cost",
      labelDe: "Reparaturrücklage (gesetzliches Minimum)",
      labelEn: "Repair reserve contribution (statutory minimum)",
      amountCents: Number(divRound(BigInt(minimum.value) * BigInt(n.areaHundredths), 100n, "halfUp")),
      calculation: `${formatEur(minimum.value)} per m² × ${n.areaHundredths / 100} m², rounded to the cent`,
      ruleIds: [minimum.id],
      assumptionIds: [],
      citations: [cite(minimum)],
    });
    flags.push({
      id: "assumption.reserveMinimum",
      severity: "info",
      message: `Repair reserve set to the statutory minimum of ${formatEur(minimum.value)} per m² (${formatEur(reserveCents)} a month)${ownership === undefined ? ", assuming a condominium" : ""}. Many buildings collect more; check the Vorschreibung and pass ownerCosts.reserveFundMonthly.`,
      citations: [cite(minimum)],
    });
  } else if (weg) {
    flags.push({
      id: "inputs.reserveUnknown",
      severity: "high",
      message:
        "No repair-reserve contribution and no floor area given, so the reserve is left out and cash flow is overstated. Pass ownerCosts.reserveFundMonthly or property.livingAreaM2.",
      citations: [],
    });
  }

  const maintenanceCents = line({
    id: "maintenance",
    kind: "cost",
    labelDe: "Instandhaltung (Eigentümer)",
    labelEn: "Owner's maintenance",
    amountCents:
      n.maintenanceCents ??
      Number(divRound(BigInt(totalInvestmentCents) * BigInt(maintenancePpm), BigInt(PPM_PER_UNIT) * 12n, "halfUp")),
    calculation:
      n.maintenanceCents !== undefined
        ? "Input"
        : `${formatPpm(maintenancePpm)} per year × ${formatEur(totalInvestmentCents)} (price plus acquisition costs) ÷ 12`,
    ruleIds: [],
    assumptionIds: n.maintenanceCents !== undefined ? [] : ["maintenancePctPerYear"],
    citations: [],
  });

  // Metrics
  const noi = rentCents - vacancyCents - managementCents - reserveCents - maintenanceCents;
  const cashFlow = noi - paymentCents;
  const equityCents = totalInvestmentCents - loanCents;

  const fixedCosts = BigInt(paymentCents + reserveCents + maintenanceCents);
  const share = BigInt(PPM_PER_UNIT - vacancyPpm - managementPpm);
  const breakEvenRentCents =
    share > 0n
      ? Number(
          divRound(
            fixedCosts * BigInt(PPM_PER_UNIT) + BigInt(vacancyPpm) * BigInt(n.operatingCostsCents),
            share,
            "ceil",
          ),
        )
      : null;

  const metrics: UnderwriteMetrics = {
    monthlyNoiCents: noi,
    annualNoiCents: noi * 12,
    monthlyCashFlowCents: cashFlow,
    annualCashFlowCents: cashFlow * 12,
    monthlyCashFlow: centsToEur(cashFlow),
    grossYieldPct: percent(rentCents * 12, priceCents),
    netYieldPct: percent(noi * 12, totalInvestmentCents),
    cashOnCashPct: equityCents > 0 ? percent(cashFlow * 12, equityCents) : null,
    dscr: paymentCents > 0 ? ratio(noi, paymentCents, 2) : null,
    totalInvestmentCents,
    equityCents,
    breakEvenRentCents,
    breakEvenRentPerM2:
      breakEvenRentCents !== null && n.areaHundredths !== undefined ? ratio(breakEvenRentCents, n.areaHundredths, 2) : null,
  };

  // Rent regulation
  const rentRegulation = classifyRentRegulation(input.property ?? {}, rules);
  if (rentRegulation.status === "full") {
    flags.push({
      id: "rent.fullMrg",
      severity: rentRegulation.basis === "permitDate" ? "high" : "warn",
      message: `${rentRegulation.summary} The assumed rent of ${formatEur(n.rentCents)} may exceed what can lawfully be charged; tenants can reclaim overpaid rent.`,
      citations: rentRegulation.citations,
    });
  } else if (rentRegulation.status === "unknown") {
    flags.push({
      id: "rent.regulationUnknown",
      severity: "warn",
      message: rentRegulation.summary,
      citations: rentRegulation.citations,
    });
  } else if (rentRegulation.basis === "buildingYear") {
    flags.push({
      id: "rent.regulationEstimated",
      severity: "info",
      message: rentRegulation.summary,
      citations: rentRegulation.citations,
    });
  }
  if (input.property?.publicFunding === true) {
    flags.push({
      id: "rent.publicFunding",
      severity: "warn",
      message:
        "The building was built with public funds. Subsidy rules (e.g. Wohnbauförderung conditions) can cap the rent independently of the MRG; check the funding terms.",
      citations: [],
    });
  }

  // Cash-flow and financing flags
  if (noi < 0) {
    flags.push({
      id: "cashflow.operatingLoss",
      severity: "high",
      message: `Costs exceed the rent even before the loan: NOI is ${formatEur(noi)} a month.`,
      citations: [],
    });
  } else if (cashFlow < 0) {
    flags.push({
      id: "cashflow.negative",
      severity: "warn",
      message: `Monthly cash flow is ${formatEur(cashFlow)} before tax. Break-even rent is ${breakEvenRentCents === null ? "not reachable" : formatEur(breakEvenRentCents)}.`,
      citations: [],
    });
  }
  if (financing) {
    if (financing.ltvPct > HEURISTICS.highLtvPct) {
      flags.push({
        id: "financing.highLtv",
        severity: financing.ltvPct > HEURISTICS.veryHighLtvPct ? "high" : "warn",
        message: `The loan is ${financing.ltvPct}% of the purchase price. High leverage magnifies losses if rents fall or rates rise.`,
        citations: [],
      });
    }
    if (metrics.dscr !== null && metrics.dscr >= 1 && metrics.dscr < HEURISTICS.thinDscr) {
      flags.push({
        id: "financing.thinDscr",
        severity: "warn",
        message: `NOI covers the loan payment only ${metrics.dscr} times; a small rise in vacancy or costs turns cash flow negative.`,
        citations: [],
      });
    }
  }
  if (equityCents <= 0) {
    flags.push({
      id: "financing.noEquity",
      severity: "warn",
      message: "The loan covers the full price and acquisition costs, so there is no equity and cash-on-cash return is not meaningful.",
      citations: [],
    });
  }
  // Rental income tax
  const taxCalculation = rentalTax({
    rules,
    ownership,
    unitsInBuilding: input.property?.unitsInBuilding,
    buildingYear: input.property?.buildingYear,
    totalInvestmentCents,
    mortgageFeeCents: acquisition.lineItems.find((l) => l.id === "grundbuch.pfandrecht")?.amountCents ?? 0,
    schedule,
    termYears: financing?.termYears ?? 0,
    monthly: {
      rentCents,
      vacancyCents,
      managementCents,
      maintenanceCents,
      reserveCents,
      noiCents: noi,
    },
    landShare: {
      ...(n.tax.landSharePpm === undefined ? {} : { inputPpm: n.tax.landSharePpm }),
      ...(n.tax.inhabitants === undefined ? {} : { municipalityInhabitants: n.tax.inhabitants }),
      ...(n.tax.landPriceCents === undefined ? {} : { landPriceCentsPerM2: n.tax.landPriceCents }),
      ...(input.property?.unitsInBuilding === undefined ? {} : { unitsInBuilding: input.property.unitsInBuilding }),
    },
    otherIncomeCents: n.tax.otherIncomeCents,
    marginalRatePpm: pctToPpm(n.operating.marginalTaxRatePct) as Ppm,
    marginalRateDefaulted: n.operatingDefaulted.includes("marginalTaxRatePct"),
  });
  flags.push(...taxCalculation.flags);

  const defaultedShown = n.operatingDefaulted.filter(
    (id) => id !== "managementPct" && id !== "marginalTaxRatePct" && !(id === "maintenancePctPerYear" && n.maintenanceCents !== undefined),
  );
  if (defaultedShown.length > 0) {
    flags.push({
      id: "assumption.operatingDefaults",
      severity: "info",
      message: `Default assumptions used: ${defaultedShown
        .map((id) => (id === "vacancyPct" ? `vacancy ${vacancyPct}% of gross rent` : `maintenance ${maintenancePctPerYear}% of the total investment per year`))
        .join(", ")}. Override them in assumptions if you know better.`,
      citations: [],
    });
  }

  const order: Record<Flag["severity"], number> = { high: 0, warn: 1, info: 2 };
  flags.sort((a, b) => order[a.severity] - order[b.severity]);

  const assumptionsDefaulted: UnderwriteAssumptionId[] = [...acquisition.assumptionsDefaulted, ...n.operatingDefaulted];

  return {
    engineVersion: ENGINE_VERSION,
    valuationDate: date,
    currency: "EUR",
    acquisition,
    financing,
    operating,
    metrics,
    rentRegulation,
    tax: taxCalculation.tax,
    flags,
    assumptionsUsed: { ...acquisition.assumptionsUsed, ...n.operating },
    assumptionsDefaulted,
    rulesUsed: rules.list(),
    limitations: [...UNDERWRITE_LIMITATIONS],
    disclaimer: DISCLAIMER,
  };
}
