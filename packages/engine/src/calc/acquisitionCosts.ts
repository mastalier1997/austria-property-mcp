import {
  ACQUISITION_ASSUMPTIONS,
  defaultAcquisitionAssumptions,
  type AcquisitionAssumptions,
  type AssumptionId,
} from "../assumptions.js";
import { METHOD_CITATIONS, type Citation } from "../citations.js";
import { isIsoDate } from "../dates.js";
import {
  applyRate,
  ceilToEuros,
  centsToEur,
  divRound,
  eurToCents,
  formatEur,
  formatPpm,
  PPM_PER_UNIT,
  pctToPpm,
  type Cents,
  type Ppm,
} from "../money.js";
import { getRule, type Rule, type RuleId } from "../rules/index.js";
import type {
  AcquisitionCostsInput,
  AcquisitionCostsResult,
  Flag,
  LineItem,
  LineItemId,
  RuleUsed,
} from "../types.js";
import { ENGINE_VERSION } from "../version.js";
import { brokerCap } from "./brokerCap.js";

/** Largest price or loan accepted, in cents (€1 billion). */
const MAX_AMOUNT_CENTS = 100_000_000_000;
/** Commission percentages above this are rejected as input errors (10%). */
const MAX_COMMISSION_PPM = 100_000;

export interface InputIssue {
  path: string;
  message: string;
}

/** Thrown when the input is malformed. Lists every problem found, not just the first. */
export class InputError extends Error {
  override readonly name = "InputError";
  constructor(readonly issues: InputIssue[]) {
    super(`Invalid input: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
  }
}

export const LIMITATIONS: readonly string[] = Object.freeze([
  "Assumes an arm's-length purchase from a third party (entgeltlicher Erwerb). Transfers within the family or below full value follow different Grunderwerbsteuer rules.",
  "The purchase price is the base for all taxes and fees. Separately priced furniture or fittings, assumed liabilities and similar adjustments are not modelled.",
  "No exemptions are applied, such as the time-limited Grundbuch fee exemption for buying a primary residence; the engine targets buy-to-let purchases.",
  "All rules are taken as valid on valuationDate. In practice, Grundbuch fees depend on when the fee claim arises, usually the registration date.",
  "Bank fees, valuation fees, signature certification and loan interest are not included.",
]);

export const DISCLAIMER =
  "Calculation only, not investment, tax or legal advice. Confirm figures with a notary, lawyer or tax adviser before relying on them.";

interface NormalisedInput {
  date: string;
  priceCents: Cents;
  broker: { commissionPpm: Ppm; sellerPaysCommission: boolean | undefined } | undefined;
  financing: { loanCents: Cents; registeredCents: Cents | undefined } | undefined;
  assumptions: AcquisitionAssumptions;
  assumptionsDefaulted: AssumptionId[];
}

function normalise(input: AcquisitionCostsInput): NormalisedInput {
  const issues: InputIssue[] = [];
  const amount = (path: string, value: unknown, allowZero: boolean): Cents => {
    const cents = typeof value === "number" ? eurToCents(value) : undefined;
    if (cents === undefined) {
      issues.push({ path, message: "must be a number in EUR with at most two decimals" });
      return 0;
    }
    if (cents < 0 || (!allowZero && cents === 0)) {
      issues.push({ path, message: allowZero ? "must not be negative" : "must be greater than 0" });
    } else if (cents > MAX_AMOUNT_CENTS) {
      issues.push({ path, message: "must not exceed €1,000,000,000" });
    }
    return cents;
  };

  if (typeof input !== "object" || input === null) {
    throw new InputError([{ path: "", message: "input must be an object" }]);
  }

  const date = input.valuationDate;
  if (!isIsoDate(date)) issues.push({ path: "valuationDate", message: "must be a date in YYYY-MM-DD form" });

  const priceCents = amount("purchasePrice", input.purchasePrice, false);

  let broker: NormalisedInput["broker"];
  if (input.broker === "none") {
    broker = undefined;
  } else if (typeof input.broker === "object" && input.broker !== null) {
    const ppm = typeof input.broker.commissionPct === "number" ? pctToPpm(input.broker.commissionPct) : undefined;
    if (ppm === undefined || ppm < 0 || ppm > MAX_COMMISSION_PPM) {
      issues.push({ path: "broker.commissionPct", message: "must be a percentage between 0 and 10, excluding USt" });
    }
    const seller = input.broker.sellerPaysCommission;
    if (seller !== undefined && typeof seller !== "boolean") {
      issues.push({ path: "broker.sellerPaysCommission", message: "must be true, false or omitted" });
    }
    broker = ppm && ppm > 0 ? { commissionPpm: ppm, sellerPaysCommission: seller } : undefined;
  } else {
    issues.push({ path: "broker", message: 'must be "none" or { commissionPct }' });
  }

  let financing: NormalisedInput["financing"];
  if (input.financing !== undefined) {
    if (typeof input.financing !== "object" || input.financing === null) {
      issues.push({ path: "financing", message: "must be an object or omitted" });
    } else {
      const loanCents = amount("financing.loanAmount", input.financing.loanAmount, true);
      const registeredCents =
        input.financing.registeredMortgageAmount === undefined
          ? undefined
          : amount("financing.registeredMortgageAmount", input.financing.registeredMortgageAmount, true);
      financing = loanCents > 0 ? { loanCents, registeredCents } : undefined;
    }
  }

  const assumptions = defaultAcquisitionAssumptions();
  const assumptionsDefaulted: AssumptionId[] = [];
  const given = input.assumptions ?? {};
  if (typeof given !== "object" || given === null) {
    issues.push({ path: "assumptions", message: "must be an object or omitted" });
  } else {
    for (const key of Object.keys(given)) {
      if (!(key in ACQUISITION_ASSUMPTIONS)) issues.push({ path: `assumptions.${key}`, message: "unknown assumption" });
    }
    for (const id of Object.keys(ACQUISITION_ASSUMPTIONS) as AssumptionId[]) {
      const value = (given as Record<string, unknown>)[id];
      if (value === undefined) {
        assumptionsDefaulted.push(id);
        continue;
      }
      const def = ACQUISITION_ASSUMPTIONS[id] as { min?: number; max?: number; allowed?: readonly unknown[] };
      if (def.allowed) {
        if (!def.allowed.includes(value)) {
          issues.push({ path: `assumptions.${id}`, message: `must be one of ${def.allowed.join(", ")}` });
          continue;
        }
      } else if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (def.min !== undefined && value < def.min) ||
        (def.max !== undefined && value > def.max)
      ) {
        issues.push({ path: `assumptions.${id}`, message: `must be a number between ${def.min} and ${def.max}` });
        continue;
      }
      if (id === "grundbuchApplications" && !Number.isInteger(value)) {
        issues.push({ path: `assumptions.${id}`, message: "must be a whole number" });
        continue;
      }
      (assumptions as unknown as Record<string, unknown>)[id] = value;
    }
  }
  if (pctToPpm(assumptions.contractFeePct) === undefined) {
    issues.push({ path: "assumptions.contractFeePct", message: "must have at most four decimals" });
  }
  if (factorToPpm(assumptions.mortgageRegistrationFactor) === undefined) {
    issues.push({ path: "assumptions.mortgageRegistrationFactor", message: "must have at most six decimals" });
  }

  if (issues.length > 0) throw new InputError(issues);
  return { date, priceCents, broker, financing, assumptions, assumptionsDefaulted };
}

function factorToPpm(factor: number): Ppm | undefined {
  const scaled = factor * PPM_PER_UNIT;
  const ppm = Math.round(scaled);
  return Math.abs(scaled - ppm) > 1e-6 ? undefined : ppm;
}

/** Court fee: base rounded up to whole euros, percentage fee rounded up to whole euros (§ 6 Abs. 2 GGG). */
function courtFeeCents(baseCents: Cents, rate: Ppm): Cents {
  const baseEuros = ceilToEuros(baseCents);
  const feeEuros = divRound(BigInt(baseEuros) * BigInt(rate), BigInt(PPM_PER_UNIT), "ceil");
  return Number(feeEuros) * 100;
}

function cite(rule: Rule): Citation {
  return { legalBasis: rule.legalBasis, sourceUrl: rule.sourceUrl };
}

/**
 * One-off costs of buying an Austrian residential property: Grunderwerbsteuer,
 * Grundbuch fees, broker commission and contract costs.
 *
 * Pure and deterministic: the same input always gives the same output.
 * Throws InputError for malformed input and RuleNotCoveredError if the
 * valuation date is outside the dates the rule catalogue covers.
 */
export function acquisitionCosts(input: AcquisitionCostsInput): AcquisitionCostsResult {
  const n = normalise(input);
  const { date, priceCents, assumptions } = n;

  const used = new Map<string, RuleUsed>();
  const use = (id: RuleId): Rule => {
    const rule = getRule(id, date);
    const usedEntry: RuleUsed = {
      id: rule.id,
      value: rule.value,
      unit: rule.unit,
      validFrom: rule.validFrom,
      verifiedOn: rule.verifiedOn,
    };
    if (rule.validTo !== undefined) usedEntry.validTo = rule.validTo;
    used.set(`${rule.id}@${rule.validFrom}`, usedEntry);
    return rule;
  };

  const items: LineItem[] = [];
  const flags: Flag[] = [];
  const add = (item: Omit<LineItem, "amount">): void => {
    items.push({ ...item, amount: centsToEur(item.amountCents) });
  };

  // Grunderwerbsteuer
  const grest = use("at.grest.rate");
  add({
    id: "grest",
    labelDe: "Grunderwerbsteuer",
    labelEn: "Real estate transfer tax",
    amountCents: applyRate(priceCents, grest.value, "halfUp"),
    calculation: `${formatPpm(grest.value)} × ${formatEur(priceCents)}, rounded to the cent`,
    ruleIds: [grest.id],
    assumptionIds: [],
    citations: [cite(grest), METHOD_CITATIONS.baoRounding],
  });

  // Grundbuch: ownership registration
  const electronic = assumptions.grundbuchFiling === "electronic";
  const eigentum = use("at.ggg.eigentum.rate");
  const eigentumBase = ceilToEuros(priceCents) * 100;
  let eigentumCents = courtFeeCents(priceCents, eigentum.value);
  let eigentumCalc = `${formatPpm(eigentum.value)} × ${formatEur(eigentumBase)}, rounded up to the full euro`;
  const eigentumRuleIds: RuleId[] = [eigentum.id];
  const eigentumCitations: Citation[] = [cite(eigentum), METHOD_CITATIONS.gggRounding];
  if (electronic) {
    const reduction = use("at.ggg.eigentum.directDebitReduction");
    eigentumCents = Math.max(0, eigentumCents - reduction.value);
    eigentumCalc += `, minus ${formatEur(reduction.value)} for payment by direct debit`;
    eigentumRuleIds.push(reduction.id);
    eigentumCitations.push(cite(reduction));
  }
  add({
    id: "grundbuch.eigentum",
    labelDe: "Eintragungsgebühr Eigentumsrecht",
    labelEn: "Land register fee, ownership",
    amountCents: eigentumCents,
    calculation: eigentumCalc,
    ruleIds: eigentumRuleIds,
    assumptionIds: ["grundbuchFiling"],
    citations: eigentumCitations,
  });

  // Grundbuch: mortgage registration
  if (n.financing) {
    const pfand = use("at.ggg.pfandrecht.rate");
    const derived = n.financing.registeredCents === undefined;
    const factorPpm = factorToPpm(assumptions.mortgageRegistrationFactor) as Ppm;
    const registeredCents = derived
      ? applyRate(n.financing.loanCents, factorPpm, "halfUp")
      : (n.financing.registeredCents as Cents);
    const registeredDesc = derived
      ? `${formatEur(registeredCents)} registered mortgage (loan ${formatEur(n.financing.loanCents)} × ${assumptions.mortgageRegistrationFactor})`
      : `${formatEur(registeredCents)} registered mortgage`;
    add({
      id: "grundbuch.pfandrecht",
      labelDe: "Eintragungsgebühr Pfandrecht",
      labelEn: "Land register fee, mortgage",
      amountCents: courtFeeCents(registeredCents, pfand.value),
      calculation: `${formatPpm(pfand.value)} × ${registeredDesc}, base and fee rounded up to the full euro`,
      ruleIds: [pfand.id],
      assumptionIds: derived ? ["mortgageRegistrationFactor"] : [],
      citations: [cite(pfand), METHOD_CITATIONS.gggRounding],
    });
    if (derived) {
      flags.push({
        id: "assumption.mortgageRegistration",
        severity: "info",
        message: `Registered mortgage assumed at ${assumptions.mortgageRegistrationFactor} × the loan (${formatEur(registeredCents)}). Ask the bank for the actual amount and pass registeredMortgageAmount.`,
        citations: [],
      });
    }
  }

  // Grundbuch: filing fee
  const eingabe = use("at.ggg.eingabe.fee");
  let perApplication = eingabe.value;
  let eingabeCalc = `${formatEur(eingabe.value)} per application`;
  const eingabeRuleIds: RuleId[] = [eingabe.id];
  const eingabeCitations: Citation[] = [cite(eingabe)];
  if (!electronic) {
    const surcharge = use("at.ggg.eingabe.paperSurcharge");
    perApplication += surcharge.value;
    eingabeCalc += ` plus ${formatEur(surcharge.value)} paper-filing surcharge`;
    eingabeRuleIds.push(surcharge.id);
    eingabeCitations.push(cite(surcharge));
  }
  eingabeCalc += ` × ${assumptions.grundbuchApplications}`;
  add({
    id: "grundbuch.eingabe",
    labelDe: "Eingabengebühr Grundbuch",
    labelEn: "Land register filing fee",
    amountCents: perApplication * assumptions.grundbuchApplications,
    calculation: eingabeCalc,
    ruleIds: eingabeRuleIds,
    assumptionIds: ["grundbuchFiling", "grundbuchApplications"],
    citations: eingabeCitations,
  });

  // Broker commission
  const vat = n.broker || assumptions.contractFeePct > 0 ? use("at.ust.standardRate") : undefined;
  if (n.broker && vat) {
    const netCents = applyRate(priceCents, n.broker.commissionPpm, "halfUp");
    add({
      id: "broker.commission",
      labelDe: "Maklerprovision",
      labelEn: "Broker commission",
      amountCents: netCents,
      calculation: `${formatPpm(n.broker.commissionPpm)} × ${formatEur(priceCents)}, rounded to the cent`,
      ruleIds: [],
      assumptionIds: [],
      citations: [],
    });
    add({
      id: "broker.vat",
      labelDe: "USt auf Maklerprovision",
      labelEn: "VAT on broker commission",
      amountCents: applyRate(netCents, vat.value, "halfUp"),
      calculation: `${formatPpm(vat.value)} × ${formatEur(netCents)}, rounded to the cent`,
      ruleIds: [vat.id],
      assumptionIds: [],
      citations: [cite(vat)],
    });

    const cap = brokerCap(priceCents, date);
    for (const id of cap.ruleIds) use(id);
    const pct = formatPpm(n.broker.commissionPpm);
    const seller = n.broker.sellerPaysCommission;
    const maxAllowed = seller === true ? cap.capCents : cap.oneSidedCapCents;
    if (netCents > maxAllowed) {
      const why =
        seller === true
          ? ` With the seller also paying commission, only the part of the seller's shortfall below ${formatEur(cap.capCents)} may be added (§ 12 Abs. 2).`
          : ` This is above the ${formatEur(cap.oneSidedCapCents)} allowed even when the seller pays no commission.`;
      flags.push({
        id: "broker.aboveCap",
        severity: "high",
        message: `The commission of ${formatEur(netCents)} (${pct} excl. USt) exceeds the legal maximum of ${formatEur(cap.capCents)} per party for this price.${why}`,
        citations: cap.citations,
      });
    } else if (netCents > cap.capCents) {
      flags.push({
        id: "broker.lawfulOnlyIfSellerPaysNothing",
        severity: "warn",
        message: `The commission of ${formatEur(netCents)} (${pct} excl. USt) exceeds the standard maximum of ${formatEur(cap.capCents)} per party. It is lawful only if the seller pays no commission (then up to ${formatEur(cap.oneSidedCapCents)}), or by as much as the seller's commission falls short of the cap. Ask the broker what the seller pays.`,
        citations: cap.citations,
      });
    }
  }

  // Contract drafting and Treuhand
  const contractPpm = pctToPpm(assumptions.contractFeePct) as Ppm;
  if (contractPpm > 0 && vat) {
    const netCents = applyRate(priceCents, contractPpm, "halfUp");
    add({
      id: "contract.fee",
      labelDe: "Vertragserrichtung und Treuhandschaft",
      labelEn: "Contract drafting and escrow",
      amountCents: netCents,
      calculation: `${formatPpm(contractPpm)} × ${formatEur(priceCents)} (assumption), rounded to the cent`,
      ruleIds: [],
      assumptionIds: ["contractFeePct"],
      citations: [],
    });
    add({
      id: "contract.vat",
      labelDe: "USt auf Vertragserrichtung",
      labelEn: "VAT on contract drafting",
      amountCents: applyRate(netCents, vat.value, "halfUp"),
      calculation: `${formatPpm(vat.value)} × ${formatEur(netCents)}, rounded to the cent`,
      ruleIds: [vat.id],
      assumptionIds: ["contractFeePct"],
      citations: [cite(vat)],
    });
    if (n.assumptionsDefaulted.includes("contractFeePct")) {
      flags.push({
        id: "assumption.contractFee",
        severity: "info",
        message: `Contract drafting and Treuhand estimated at ${formatPpm(contractPpm)} of the price plus USt. Actual fees follow the lawyer's or notary's tariff or a flat fee; ask for a quote and pass assumptions.contractFeePct.`,
        citations: [],
      });
    }
  }

  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  const totalPctOfPrice =
    Number(divRound(BigInt(totalCents) * 10_000n, BigInt(priceCents), "halfUp")) / 100;

  const lineItemOrder: LineItemId[] = [
    "grest",
    "grundbuch.eigentum",
    "grundbuch.pfandrecht",
    "grundbuch.eingabe",
    "broker.commission",
    "broker.vat",
    "contract.fee",
    "contract.vat",
  ];
  items.sort((a, b) => lineItemOrder.indexOf(a.id) - lineItemOrder.indexOf(b.id));

  return {
    engineVersion: ENGINE_VERSION,
    valuationDate: date,
    currency: "EUR",
    purchasePriceCents: priceCents,
    lineItems: items,
    totalCents,
    total: centsToEur(totalCents),
    totalPctOfPrice,
    flags,
    assumptionsUsed: { ...assumptions },
    assumptionsDefaulted: n.assumptionsDefaulted,
    rulesUsed: [...used.values()].sort((a, b) => a.id.localeCompare(b.id)),
    limitations: [...LIMITATIONS],
    disclaimer: DISCLAIMER,
  };
}
