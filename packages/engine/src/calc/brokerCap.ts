import { METHOD_CITATIONS, type Citation } from "../citations.js";
import type { IsoDate } from "../dates.js";
import { divRound, PPM_PER_UNIT, type Cents } from "../money.js";
import { getNumericRule, type RuleId } from "../rules/index.js";

export interface BrokerCap {
  /** Maximum commission per party, excluding USt, in cents (rounded half up). */
  capCents: Cents;
  /** Maximum for one party if the other party pays no commission (§ 12 Abs. 2). */
  oneSidedCapCents: Cents;
  /** Which part of the tariff set the cap. */
  basis: "lowerBracket" | "upperBracket" | "lowerBracketFloor";
  ruleIds: RuleId[];
  citations: Citation[];
}

/**
 * Statutory maximum broker commission for buying or selling property, per party.
 *
 * § 15 Abs. 2: 4% up to the bracket limit, 3% above it.
 * § 12 Abs. 4: above the limit, the cap never falls below 4% of the limit, which
 * gives the flat €1,453.46 band (up to €48,448.56, where 3% catches up).
 */
export function brokerCap(valueCents: Cents, date: IsoDate): BrokerCap {
  const limit = getNumericRule("at.makler.lowerBracketLimit", date);
  const lower = getNumericRule("at.makler.lowerBracketRate", date);
  const upper = getNumericRule("at.makler.upperBracketRate", date);
  const oneSided = getNumericRule("at.makler.oneSidedIncrease", date);

  // Exact caps in cents × ppm, compared before any rounding.
  const value = BigInt(valueCents);
  let exact: bigint;
  let basis: BrokerCap["basis"];
  if (valueCents <= limit.value) {
    exact = value * BigInt(lower.value);
    basis = "lowerBracket";
  } else {
    const byRate = value * BigInt(upper.value);
    const floor = BigInt(limit.value) * BigInt(lower.value);
    if (byRate >= floor) {
      exact = byRate;
      basis = "upperBracket";
    } else {
      exact = floor;
      basis = "lowerBracketFloor";
    }
  }

  const ppm = BigInt(PPM_PER_UNIT);
  const capCents = Number(divRound(exact, ppm, "halfUp"));
  const oneSidedExact = exact * (ppm + BigInt(oneSided.value));
  const oneSidedCapCents = Number(divRound(oneSidedExact, ppm * ppm, "halfUp"));

  const citations: Citation[] = [
    { legalBasis: lower.legalBasis.replace(" Z 1", ""), sourceUrl: lower.sourceUrl },
    METHOD_CITATIONS.maklerValue,
    METHOD_CITATIONS.maklerVatExcluded,
  ];
  if (basis === "lowerBracketFloor") citations.push(METHOD_CITATIONS.maklerFloor);
  citations.push(METHOD_CITATIONS.maklerOneSided);

  return {
    capCents,
    oneSidedCapCents,
    basis,
    ruleIds: [
      "at.makler.lowerBracketLimit",
      "at.makler.lowerBracketRate",
      "at.makler.upperBracketRate",
      "at.makler.oneSidedIncrease",
    ],
    citations,
  };
}
