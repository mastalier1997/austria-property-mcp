/**
 * Input schemas for the MCP tools. They describe the shape and meaning of each
 * field for the agent; range checks and legal limits stay in the engine, which
 * reports every problem at once.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const valuationDate = isoDate
  .optional()
  .describe(
    "Date whose rules apply, YYYY-MM-DD, usually today or the expected signing date. Defaults to today (Vienna time). Covered: 2025-04-01 to 2027-12-31.",
  );

export const purchasePrice = z
  .number()
  
  .describe("Purchase price in EUR (the agreed price for the property), e.g. 249000.");

export const broker = z
  .union([
    z.literal("none"),
    z.object({
      commissionPct: z
        .number()
        
        .describe("Buyer's broker commission in % of the price, EXCLUDING 20% VAT. Listings often say '3% zzgl. 20% USt' → 3."),
      sellerPaysCommission: z
        .boolean()
        .optional()
        .describe("Whether the seller also pays the broker. Affects the legal cap. Omit if unknown."),
    }),
  ])
  .describe('Broker commission, or "none" if the purchase is commission-free (provisionsfrei).');

const loanAmount = z.number().describe("Loan amount in EUR.");
const registeredMortgageAmount = z
  .number()
  
  .optional()
  .describe("Mortgage amount registered in the land register, if known. Defaults to 1.3 × the loan.");

const acquisitionAssumptionFields = {
  contractFeePct: z
    .number()
    .optional()
    .describe("Lawyer/notary contract and escrow fee, % of price excl. VAT. Default 1.5 (typical range 1–3)."),
  mortgageRegistrationFactor: z
    .number()
    .optional()
    .describe("Registered mortgage as a multiple of the loan. Default 1.3."),
  grundbuchFiling: z
    .enum(["electronic", "paper"])
    .optional()
    .describe('How the land-register application is filed. Default "electronic" (lawyer or notary).'),
  grundbuchApplications: z
    .number()
    .int()
    .optional()
    .describe("Number of separate land-register applications. Default 1."),
};

const operatingAssumptionFields = {
  vacancyPct: z
    .number()
    .optional()
    .describe("Vacancy and rent loss, % of gross rent (rent + operating costs). Default 4."),
  maintenancePctPerYear: z
    .number()
    .optional()
    .describe("Owner's maintenance, % per year of price plus acquisition costs. Default 0.2."),
  managementPct: z
    .number()
    .optional()
    .describe("Letting/management fees paid by the owner, % of net cold rent. Default 0 (self-managed)."),
  marginalTaxRatePct: z
    .number()
    .optional()
    .describe("Owner's marginal income tax rate in %, applied to the rental result. Default 40. Ignored when tax.otherTaxableIncome is given."),
};

export const acquisitionInput = {
  valuationDate,
  purchasePrice,
  broker,
  financing: z
    .object({ loanAmount, registeredMortgageAmount })
    .optional()
    .describe("Mortgage financing, if any. Adds the court fee for registering the mortgage."),
  assumptions: z
    .object(acquisitionAssumptionFields)
    .optional()
    .describe("Override default assumptions. Omit to use documented defaults."),
};

export const underwriteInput = {
  valuationDate,
  purchasePrice,
  broker,
  financing: z
    .object({
      loanAmount,
      ratePct: z.number().describe("Nominal annual interest rate in %, e.g. 3.9. Treated as fixed for the whole term."),
      termYears: z.number().int().describe("Loan term in whole years, e.g. 25."),
      registeredMortgageAmount,
    })
    .optional()
    .describe("Mortgage financing. Omit for a cash purchase."),
  property: z
    .object({
      livingAreaM2: z.number().optional().describe("Usable floor area (Nutzfläche) in m²."),
      ownership: z
        .enum(["condominium", "house", "wholeBuilding"])
        .optional()
        .describe("condominium = Eigentumswohnung (Wohnungseigentum); house = single-family house; wholeBuilding = entire rental building."),
      buildingPermitDate: isoDate
        .optional()
        .describe("Date of the building permit (Baubewilligung), YYYY-MM-DD. Decides whether MRG rent caps apply."),
      buildingYear: z.number().int().optional().describe("Year the building was completed (Baujahr). Used as an estimate if the permit date is unknown."),
      publicFunding: z.boolean().optional().describe("Whether the building was built with public funds (e.g. Wohnbauförderung)."),
      unitsInBuilding: z.number().int().optional().describe("Number of separate flats or business units in the building."),
    })
    .optional()
    .describe("Property facts. Pass what you know; missing facts are flagged."),
  rent: z
    .object({
      netColdMonthly: z.number().describe("Monthly net cold rent (Hauptmietzins) in EUR, excluding operating costs and VAT."),
      operatingCostsMonthly: z
        .number()
        
        .optional()
        .describe("Monthly operating costs (Betriebskosten) in EUR, passed on to the tenant."),
    })
    .describe("Expected rent."),
  ownerCosts: z
    .object({
      reserveFundMonthly: z
        .number()
        
        .optional()
        .describe("The flat's monthly repair-reserve contribution (Rücklage) in EUR. Defaults to the legal minimum per m² for condominiums."),
      maintenanceMonthly: z.number().optional().describe("Monthly maintenance budget in EUR; overrides maintenancePctPerYear."),
    })
    .optional()
    .describe("Costs the owner pays that cannot be passed on to the tenant."),
  tax: z
    .object({
      otherTaxableIncome: z
        .number()
        .optional()
        .describe("Owner's other taxable income per year in EUR (e.g. gross salary minus social security). Enables the exact income tax tariff."),
      landSharePct: z
        .number()
        .optional()
        .describe("Land share of the purchase in %, if proven (e.g. expert opinion). Otherwise presumed at 20, 30 or 40% by law."),
      municipalityInhabitants: z
        .number()
        .int()
        .optional()
        .describe("Inhabitants of the municipality (e.g. Vienna ≈ 2,000,000). Decides the presumed land share together with the land price."),
      averageLandPricePerM2: z
        .number()
        .optional()
        .describe("Average price of building land in the municipality, EUR per m². Under 400 in a town under 100,000 inhabitants → 20% land share."),
    })
    .optional()
    .describe("Facts for the income tax on rent and the depreciation (AfA). Omit to use flagged defaults (40% marginal rate, 40% land share)."),
  assumptions: z
    .object({ ...acquisitionAssumptionFields, ...operatingAssumptionFields })
    .optional()
    .describe("Override default assumptions. Omit to use documented defaults."),
};

export const rulesInput = {
  date: isoDate.optional().describe("Return the rules valid on this date, YYYY-MM-DD. Defaults to today (Vienna time)."),
};
