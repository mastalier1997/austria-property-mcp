import type {
  AcquisitionAssumptions,
  AssumptionId,
  OperatingAssumptionId,
  UnderwriteAssumptions,
} from "./assumptions.js";
import type { Ownership, RentRegulation } from "./calc/rentRegulation.js";
import type { Citation } from "./citations.js";
import type { IsoDate } from "./dates.js";
import type { Cents } from "./money.js";
import type { RuleId, RuleUnit } from "./rules/index.js";

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
  | "assumption.mortgageRegistration"
  | "assumption.reserveMinimum"
  | "assumption.operatingDefaults"
  | "inputs.reserveUnknown"
  | "cashflow.negative"
  | "cashflow.operatingLoss"
  | "financing.highLtv"
  | "financing.thinDscr"
  | "financing.noEquity"
  | "rent.fullMrg"
  | "rent.regulationUnknown"
  | "rent.regulationEstimated"
  | "rent.publicFunding";

export type UnderwriteAssumptionId = AssumptionId | OperatingAssumptionId;

export interface Flag {
  id: FlagId;
  severity: FlagSeverity;
  message: string;
  citations: Citation[];
}

export interface RuleUsed {
  id: RuleId;
  value: number | IsoDate;
  unit: RuleUnit;
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

// ---------------------------------------------------------------------------
// Underwriting (M2)
// ---------------------------------------------------------------------------

export interface UnderwriteFinancingInput extends FinancingInput {
  /** Nominal annual interest rate in % (e.g. 3.9). Treated as fixed for the whole term. */
  ratePct: number;
  /** Loan term in whole years. */
  termYears: number;
}

export interface PropertyInput {
  /** Usable floor area (Nutzfläche) in m². */
  livingAreaM2?: number;
  /** condominium = Eigentumswohnung (Wohnungseigentum); house = single-family house; wholeBuilding = entire rental building. */
  ownership?: Ownership;
  /** Date of the building permit (Baubewilligung), YYYY-MM-DD. Decides whether rent caps apply. */
  buildingPermitDate?: IsoDate;
  /** Year the building was completed. Used as an estimate when the permit date is unknown. */
  buildingYear?: number;
  /** Whether the building was built with public funds (e.g. Wohnbauförderung). */
  publicFunding?: boolean;
  /** Number of separate flats or business units in the building. */
  unitsInBuilding?: number;
}

export interface RentInput {
  /** Monthly net cold rent (Hauptmietzins) in EUR, excluding operating costs and VAT. */
  netColdMonthly: number;
  /** Monthly operating costs (Betriebskosten) passed on to the tenant, in EUR. */
  operatingCostsMonthly?: number;
}

export interface OwnerCostsInput {
  /** The flat's monthly contribution to the repair reserve (Rücklage), in EUR. */
  reserveFundMonthly?: number;
  /** Monthly maintenance budget in EUR; overrides the maintenancePctPerYear assumption. */
  maintenanceMonthly?: number;
}

export interface UnderwriteInput {
  valuationDate: IsoDate;
  purchasePrice: number;
  broker: BrokerInput | "none";
  financing?: UnderwriteFinancingInput;
  property?: PropertyInput;
  rent: RentInput;
  ownerCosts?: OwnerCostsInput;
  assumptions?: Partial<UnderwriteAssumptions>;
}

export type OperatingLineId = "rent" | "vacancy" | "management" | "reserveFund" | "maintenance";

export interface OperatingLine {
  id: OperatingLineId;
  kind: "income" | "cost";
  labelDe: string;
  labelEn: string;
  /** Monthly amount in cents, always positive; kind says whether it adds or subtracts. */
  amountCents: Cents;
  amount: number;
  calculation: string;
  ruleIds: RuleId[];
  assumptionIds: UnderwriteAssumptionId[];
  citations: Citation[];
}

export interface FinancingResult {
  loanCents: Cents;
  ratePct: number;
  termYears: number;
  monthlyPaymentCents: Cents;
  monthlyPayment: number;
  year1InterestCents: Cents;
  year1PrincipalCents: Cents;
  balanceAfterYear1Cents: Cents;
  totalInterestCents: Cents;
  /** Loan as % of the purchase price. */
  ltvPct: number;
  calculation: string;
}

export interface UnderwriteMetrics {
  /** Net operating income per month: rent minus vacancy, management, reserve and maintenance. */
  monthlyNoiCents: Cents;
  annualNoiCents: Cents;
  /** Cash flow per month before income tax: NOI minus loan payment. */
  monthlyCashFlowCents: Cents;
  annualCashFlowCents: Cents;
  monthlyCashFlow: number;
  /** Annual net cold rent / purchase price, %. */
  grossYieldPct: number;
  /** Annual NOI / (price + acquisition costs), %. */
  netYieldPct: number;
  /** Annual cash flow / equity, %. Null if there is no positive equity. */
  cashOnCashPct: number | null;
  /** NOI / loan payment. Null without a loan. */
  dscr: number | null;
  /** Price plus acquisition costs. */
  totalInvestmentCents: Cents;
  /** Total investment minus loan. */
  equityCents: Cents;
  /** Monthly net cold rent at which cash flow reaches zero. Null if vacancy and management take 100% or more. */
  breakEvenRentCents: Cents | null;
  /** Break-even rent in EUR per m² per month. Null without a floor area. */
  breakEvenRentPerM2: number | null;
}

export interface UnderwriteResult {
  engineVersion: string;
  valuationDate: IsoDate;
  currency: "EUR";
  acquisition: AcquisitionCostsResult;
  financing: FinancingResult | null;
  /** Monthly operating income and costs. */
  operating: OperatingLine[];
  metrics: UnderwriteMetrics;
  rentRegulation: RentRegulation;
  /** All flags, including those from the acquisition-cost calculation. */
  flags: Flag[];
  assumptionsUsed: UnderwriteAssumptions;
  assumptionsDefaulted: UnderwriteAssumptionId[];
  rulesUsed: RuleUsed[];
  limitations: string[];
  disclaimer: string;
}
