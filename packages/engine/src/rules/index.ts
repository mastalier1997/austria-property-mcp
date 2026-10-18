import { isIsoDate, type IsoDate } from "../dates.js";
import { GREST_RULES } from "./grest.js";
import { GRUNDBUCH_RULES } from "./grundbuch.js";
import { MAKLER_RULES } from "./makler.js";
import { MRG_RULES } from "./mrg.js";
import { RICHTWERT_RULES } from "./richtwert.js";
import { TAX_RULES } from "./tax.js";
import type { DateRule, NumericRule, Rule, RuleId } from "./types.js";
import { UST_RULES } from "./ust.js";
import { WEG_RULES } from "./weg.js";

export type { DateRule, NumericRule, Rule, RuleId, RuleUnit } from "./types.js";

/** Every rule version the engine knows, in no particular order. */
export const RULE_CATALOGUE: readonly Rule[] = Object.freeze([
  ...GREST_RULES,
  ...GRUNDBUCH_RULES,
  ...MAKLER_RULES,
  ...UST_RULES,
  ...WEG_RULES,
  ...MRG_RULES,
  ...RICHTWERT_RULES,
  ...TAX_RULES,
]);

/** Thrown when no version of a rule covers the requested date. */
export class RuleNotCoveredError extends Error {
  override readonly name = "RuleNotCoveredError";
  constructor(
    readonly ruleId: RuleId,
    readonly date: IsoDate,
  ) {
    super(`No version of rule "${ruleId}" is known for ${date}.`);
  }
}

function covers(rule: Rule, date: IsoDate): boolean {
  return rule.validFrom <= date && (rule.validTo === undefined || date <= rule.validTo);
}

/** The version of a rule that applies on the given date. */
export function getRule(id: RuleId, date: IsoDate, catalogue: readonly Rule[] = RULE_CATALOGUE): Rule {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD.`);
  const matches = catalogue.filter((rule) => rule.id === id && covers(rule, date));
  if (matches.length === 0) throw new RuleNotCoveredError(id, date);
  if (matches.length > 1) throw new Error(`Rule "${id}" has overlapping versions on ${date}.`);
  return matches[0] as Rule;
}

/** Like getRule, for rules whose value is a number (rates, amounts, counts). */
export function getNumericRule(id: RuleId, date: IsoDate): NumericRule {
  const rule = getRule(id, date);
  if (rule.unit === "date") throw new TypeError(`Rule "${id}" is a date rule.`);
  return rule;
}

/** Like getRule, for rules whose value is a date. */
export function getDateRule(id: RuleId, date: IsoDate): DateRule {
  const rule = getRule(id, date);
  if (rule.unit !== "date") throw new TypeError(`Rule "${id}" is not a date rule.`);
  return rule;
}

/** All rule versions valid on a date, or the whole catalogue if no date is given. */
export function listRules(date?: IsoDate): Rule[] {
  if (date === undefined) return [...RULE_CATALOGUE];
  if (!isIsoDate(date)) throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD.`);
  return RULE_CATALOGUE.filter((rule) => covers(rule, date));
}

/**
 * Consistency problems in a catalogue: bad dates, bad values, overlapping
 * versions, gaps between versions of the same rule, or a rule id used with
 * different units. Empty for a valid catalogue.
 */
export function validateCatalogue(catalogue: readonly Rule[] = RULE_CATALOGUE): string[] {
  const problems: string[] = [];
  const byId = new Map<RuleId, Rule[]>();
  for (const rule of catalogue) {
    for (const [field, value] of [
      ["validFrom", rule.validFrom],
      ["validTo", rule.validTo],
      ["verifiedOn", rule.verifiedOn],
    ] as const) {
      if (value !== undefined && !isIsoDate(value)) problems.push(`${rule.id}: invalid ${field} "${value}"`);
    }
    if (rule.validTo !== undefined && rule.validTo < rule.validFrom) {
      problems.push(`${rule.id}: validTo ${rule.validTo} is before validFrom ${rule.validFrom}`);
    }
    if (rule.unit === "date") {
      if (!isIsoDate(rule.value)) problems.push(`${rule.id}: value must be a YYYY-MM-DD date`);
    } else if (!Number.isSafeInteger(rule.value) || rule.value < 0) {
      problems.push(`${rule.id}: value must be a non-negative integer (${rule.unit})`);
    }
    if (!rule.sourceUrl.startsWith("https://")) problems.push(`${rule.id}: sourceUrl must be https`);
    if (rule.publicationUrl !== undefined && !rule.publicationUrl.startsWith("https://")) {
      problems.push(`${rule.id}: publicationUrl must be https`);
    }
    byId.set(rule.id, [...(byId.get(rule.id) ?? []), rule]);
  }
  for (const [id, versions] of byId) {
    if (new Set(versions.map((v) => v.unit)).size > 1) problems.push(`${id}: versions use different units`);
    const sorted = [...versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1] as Rule;
      const next = sorted[i] as Rule;
      if (prev.validTo === undefined || prev.validTo >= next.validFrom) {
        problems.push(`${id}: versions starting ${prev.validFrom} and ${next.validFrom} overlap`);
      } else if (dayAfter(prev.validTo) !== next.validFrom) {
        problems.push(`${id}: gap between ${prev.validTo} and ${next.validFrom}`);
      }
    }
  }
  return problems;
}

function dayAfter(date: IsoDate): IsoDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
