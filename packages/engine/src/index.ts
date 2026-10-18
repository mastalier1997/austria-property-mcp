/**
 * @austria-property/engine
 *
 * Pure, deterministic underwriting engine for Austrian residential property.
 * No I/O, no network, no LLM calls. See docs/plan.md and docs/rules.md.
 */

export { ENGINE_VERSION } from "./version.js";

export {
  acquisitionCosts,
  DISCLAIMER,
  InputError,
  LIMITATIONS,
  type InputIssue,
} from "./calc/acquisitionCosts.js";
export { brokerCap, type BrokerCap } from "./calc/brokerCap.js";

export {
  getRule,
  listRules,
  RULE_CATALOGUE,
  RuleNotCoveredError,
  validateCatalogue,
  type Rule,
  type RuleId,
  type RuleUnit,
} from "./rules/index.js";

export {
  ACQUISITION_ASSUMPTIONS,
  defaultAcquisitionAssumptions,
  type AcquisitionAssumptions,
  type AssumptionDefinition,
  type AssumptionId,
  type GrundbuchFiling,
} from "./assumptions.js";

export { METHOD_CITATIONS, SOURCES, type Citation } from "./citations.js";
export { isIsoDate, type IsoDate } from "./dates.js";
export { formatEur, formatPpm, type Cents, type Ppm } from "./money.js";

export type {
  AcquisitionCostsInput,
  AcquisitionCostsResult,
  BrokerInput,
  FinancingInput,
  Flag,
  FlagId,
  FlagSeverity,
  LineItem,
  LineItemId,
  RuleUsed,
} from "./types.js";
