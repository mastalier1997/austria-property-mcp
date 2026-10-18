import type { AcquisitionAssumptions, AssumptionId } from "./assumptions.js";
import type { Citation } from "./citations.js";
import type { IsoDate } from "./dates.js";
import type { Cents } from "./money.js";
import type { RuleId } from "./rules/index.js";

export interface BrokerInput {
  /** Agreed commission in % of the purchase price, excluding 20% USt (e.g. 3 or 3.6). */
  commissionPct: number;
  /**
   * Whether the seller also pays the broker a commission. Matters for the legal cap:
   * if the seller pays nothing, the buyer's commission may be up to double the cap.
   * Leave undefined if unknown.
   */
  sellerPaysCommission?: boolean;
}

export interface FinancingInput {
  /** Loan amount in EUR. */
  loanAmount: number;
  /** Mortgage amount registered in the Grundbuch, in EUR. Defaults to loan × mortgageRegistrationFactor. */
  registeredMortgageAmount?: number;
}

export interface AcquisitionCostsInput {
  /** Date whose rules apply, YYYY-MM-DD. Usually the expected signing date. */
  valuationDate: IsoDate;
  /** Purchase price in EUR (the consideration, Gegenleistung). */
  purchasePrice: number;
  broker: BrokerInput | "none";
  financing?: FinancingInput;
  assumptions?: Partial<AcquisitionAssumptions>;
}

export type LineItemId =
  | "grest"
  | "grundbuch.eigentum"
  | "grundbuch.pfandrecht"
  | "grundbuch.eingabe"
  | "broker.commission"
  | "broker.vat"
  | "contract.fee"
  | "contract.vat";

export interface LineItem {
  id: LineItemId;
  labelDe: string;
  labelEn: string;
  /** Exact amount in euro cents. */
  amountCents: Cents;
  /** Same amount in EUR, for display. */
  amount: number;
  /** How the amount was computed, in plain English. */
  calculation: string;
  ruleIds: RuleId[];
  assumptionIds: AssumptionId[];
  citations: Citation[];
}

export type FlagSeverity = "info" | "warn" | "high";

export type FlagId =
  | "broker.aboveCap"
  | "broker.lawfulOnlyIfSellerPaysNothing"
  | "assumption.contractFee"
  | "assumption.mortgageRegistration";

export interface Flag {
  id: FlagId;
  severity: FlagSeverity;
  message: string;
  citations: Citation[];
}

export interface RuleUsed {
  id: RuleId;
  value: number;
  unit: "ppm" | "cents";
  validFrom: IsoDate;
  validTo?: IsoDate;
  verifiedOn: IsoDate;
}

export interface AcquisitionCostsResult {
  engineVersion: string;
  valuationDate: IsoDate;
  currency: "EUR";
  purchasePriceCents: Cents;
  lineItems: LineItem[];
  totalCents: Cents;
  total: number;
  /** Total acquisition costs as % of the purchase price, rounded to two decimals. */
  totalPctOfPrice: number;
  flags: Flag[];
  assumptionsUsed: AcquisitionAssumptions;
  /** Assumptions that fell back to their default because the caller did not set them. */
  assumptionsDefaulted: AssumptionId[];
  rulesUsed: RuleUsed[];
  limitations: string[];
  disclaimer: string;
}
