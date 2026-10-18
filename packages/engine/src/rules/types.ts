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
  | "at.ust.standardRate"
  | "at.weg.minReservePerM2"
  | "at.mrg.condominiumPermitAfter"
  | "at.mrg.newBuildingPermitAfter"
  | "at.mrg.exclusionMaxUnits";

/**
 * - "ppm": rate in parts per million (1% = 10_000)
 * - "cents": fixed amount in euro cents
 * - "count": a whole number (e.g. units in a building)
 * - "date": a calendar date (value is an IsoDate string)
 */
export type RuleUnit = "ppm" | "cents" | "count" | "date";

interface RuleBase {
  id: RuleId;
  description: string;
  /** First day this version applies (inclusive). */
  validFrom: IsoDate;
  /** Last day this version applies (inclusive). Open-ended if absent. */
  validTo?: IsoDate;
  legalBasis: string;
  sourceUrl: string;
  /**
   * Where the amount is officially published, when the statute only sets the
   * method (e.g. an index-linked amount announced by the Wirtschaftskammer).
   */
  publicationUrl?: string;
  /** Date the value was last checked against the official source. */
  verifiedOn: IsoDate;
  /** What exactly was checked, and any limits of that check. */
  note?: string;
}

export interface NumericRule extends RuleBase {
  unit: "ppm" | "cents" | "count";
  value: number;
}

export interface DateRule extends RuleBase {
  unit: "date";
  value: IsoDate;
}

/**
 * One version of a statutory value. A rule id can have several versions with
 * non-overlapping validity ranges; getRule picks the one valid on a given date.
 */
export type Rule = NumericRule | DateRule;
