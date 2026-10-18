import type { Citation } from "../citations.js";
import type { IsoDate } from "../dates.js";
import { getDateRule, getNumericRule, type DateRule, type NumericRule, type Rule, type RuleId } from "../rules/index.js";
import type { RuleUsed } from "../types.js";

/** Looks up rules for one valuation date and records every version used, for the output. */
export class RuleTracker {
  private readonly used = new Map<string, RuleUsed>();

  constructor(readonly valuationDate: IsoDate) {}

  numeric(id: RuleId): NumericRule {
    return this.record(getNumericRule(id, this.valuationDate));
  }

  date(id: RuleId): DateRule {
    return this.record(getDateRule(id, this.valuationDate));
  }

  /** Merges rules recorded elsewhere (e.g. a nested calculation's output). */
  addUsed(rules: readonly RuleUsed[]): void {
    for (const rule of rules) this.used.set(`${rule.id}@${rule.validFrom}`, rule);
  }

  list(): RuleUsed[] {
    return [...this.used.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  private record<T extends Rule>(rule: T): T {
    const entry: RuleUsed = {
      id: rule.id,
      value: rule.value,
      unit: rule.unit,
      validFrom: rule.validFrom,
      verifiedOn: rule.verifiedOn,
    };
    if (rule.validTo !== undefined) entry.validTo = rule.validTo;
    this.used.set(`${rule.id}@${rule.validFrom}`, entry);
    return rule;
  }
}

export function cite(rule: { legalBasis: string; sourceUrl: string }): Citation {
  return { legalBasis: rule.legalBasis, sourceUrl: rule.sourceUrl };
}
