/**
 * Market assumptions: defaults the caller can override. Unlike rules, these are
 * not set by law, so each one documents where its default comes from.
 */

export type GrundbuchFiling = "electronic" | "paper";

export interface AcquisitionAssumptions {
  /** Contract drafting and Treuhand by lawyer or notary, % of purchase price, excluding USt. */
  contractFeePct: number;
  /** Registered mortgage amount as a multiple of the loan (Höchstbetragshypothek). */
  mortgageRegistrationFactor: number;
  /** Electronic filing (ERV) pays fees by direct debit; paper filing pays a surcharge. */
  grundbuchFiling: GrundbuchFiling;
  /** Number of separate Grundbuch applications, each with its own filing fee. */
  grundbuchApplications: number;
}

export type AssumptionId = keyof AcquisitionAssumptions;

export interface AssumptionDefinition<T> {
  default: T;
  description: string;
  /** Allowed values for numbers: inclusive bounds. */
  min?: number;
  max?: number;
  allowed?: readonly T[];
  source: { label: string; url?: string };
}

export const ACQUISITION_ASSUMPTIONS: {
  [K in AssumptionId]: AssumptionDefinition<AcquisitionAssumptions[K]>;
} = {
  contractFeePct: {
    default: 1.5,
    min: 0,
    max: 10,
    description:
      "Contract drafting and Treuhand by a lawyer or notary, in % of the purchase price, excluding 20% USt. " +
      "Fees follow the chambers' tariffs or a flat fee, so ask for a quote.",
    source: {
      label: "oesterreich.gv.at gives about 1–3% of the purchase price; default is a low-to-mid estimate",
      url: "https://www.oesterreich.gv.at/de/themen/bauen_und_wohnen/wohnen/8/Seite.210150.html",
    },
  },
  mortgageRegistrationFactor: {
    default: 1.3,
    min: 1,
    max: 2,
    description:
      "Banks usually register a maximum-amount mortgage above the loan; the 1.2% court fee is charged on " +
      "the registered amount. Pass registeredMortgageAmount if you know it.",
    source: {
      label: "Hypo Tirol HIKrG information sheet: usually about 30% above the loan amount",
      url: "https://www.hypotirol.com/fileadmin/oesterreich/download/pdf/recht/hypo_tirol_informationsblatt_hypothekar_und_immobilienkreditgesetz_HIKrG.pdf",
    },
  },
  grundbuchFiling: {
    default: "electronic",
    allowed: ["electronic", "paper"],
    description:
      "Lawyers and notaries file electronically (ERV) and pay by Abbuchung und Einziehung, which reduces " +
      "the ownership registration fee (TP 9 Anm. 6 GGG). Paper filing adds a surcharge (TP 9 Anm. 1a GGG).",
    source: { label: "Assumption: purchase handled by a lawyer or notary" },
  },
  grundbuchApplications: {
    default: 1,
    min: 1,
    max: 5,
    description:
      "Each application pays the filing fee once. Set to 2 if ownership and mortgage are filed separately.",
    source: { label: "Assumption: ownership and mortgage filed in one application" },
  },
};

export function defaultAcquisitionAssumptions(): AcquisitionAssumptions {
  return {
    contractFeePct: ACQUISITION_ASSUMPTIONS.contractFeePct.default,
    mortgageRegistrationFactor: ACQUISITION_ASSUMPTIONS.mortgageRegistrationFactor.default,
    grundbuchFiling: ACQUISITION_ASSUMPTIONS.grundbuchFiling.default,
    grundbuchApplications: ACQUISITION_ASSUMPTIONS.grundbuchApplications.default,
  };
}
