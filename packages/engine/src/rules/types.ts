import type { IsoDate } from "../dates.js";

export type RuleId =
  | "at.grest.rate"
  | "at.ggg.eigentum.rate"
  | "at.ggg.eigentum.directDebitReduction"
  | "at.ggg.pfandrecht.rate"
  | "at.ggg.eingabe.fee"
  | "at.ggg.eingabe.paperSurcharge"
  | "at.makler.lowerBracketLimit"
  | "at.makler.lowerBracketRate"
  | "at.makler.upperBracketRate"
  | "at.makler.oneSidedIncrease"
  | "at.ust.standardRate";

/** "ppm": rate in parts per million (1% = 10_000). "cents": fixed amount in euro cents. */
export type RuleUnit = "ppm" | "cents";

/**
 * One version of a statutory value. A rule id can have several versions with
 * non-overlapping validity ranges; getRule picks the one valid on a given date.
 */
export interface Rule {
  id: RuleId;
  description: string;
  unit: RuleUnit;
  value: number;
  /** First day this version applies (inclusive). */
  validFrom: IsoDate;
  /** Last day this version applies (inclusive). Open-ended if absent. */
  validTo?: IsoDate;
  legalBasis: string;
  sourceUrl: string;
  /** Date the value was last checked against the official source. */
  verifiedOn: IsoDate;
  /** What exactly was checked, and any limits of that check. */
  note?: string;
}
