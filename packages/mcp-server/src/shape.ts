/**
 * Compact (`detail: "summary"`) results. Every field keeps its name and value from the
 * full result, so a summary is a subset of it; only `citations` is collected from the
 * whole result and deduplicated.
 */
import type { AcquisitionCostsResult, Citation, UnderwriteResult } from "@austria-property/engine";

export const DETAILS = ["summary", "full"] as const;
export type Detail = (typeof DETAILS)[number];

/** Every distinct citation anywhere in the result, in order of first appearance. */
function collectCitations(value: unknown, seen = new Map<string, Citation>()): Citation[] {
  if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, seen);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "citations" && Array.isArray(child)) {
        for (const c of child as Citation[]) seen.set(`${c.legalBasis}|${c.sourceUrl}`, c);
      } else {
        collectCitations(child, seen);
      }
    }
  }
  return [...seen.values()];
}

const flags = (r: { flags: AcquisitionCostsResult["flags"] }) =>
  r.flags.map(({ id, severity, message }) => ({ id, severity, message }));

export function compactAcquisition(r: AcquisitionCostsResult) {
  return {
    engineVersion: r.engineVersion,
    valuationDate: r.valuationDate,
    currency: r.currency,
    purchasePriceCents: r.purchasePriceCents,
    lineItems: r.lineItems.map(({ id, labelEn, amountCents, ruleIds }) => ({ id, labelEn, amountCents, ruleIds })),
    totalCents: r.totalCents,
    totalPctOfPrice: r.totalPctOfPrice,
    flags: flags(r),
    citations: collectCitations(r),
    assumptionsUsed: r.assumptionsUsed,
    assumptionsDefaulted: r.assumptionsDefaulted,
    limitations: r.limitations,
    disclaimer: r.disclaimer,
  };
}

export function compactUnderwrite(r: UnderwriteResult) {
  const m = r.metrics;
  const l = r.tax.liebhaberei;
  return {
    engineVersion: r.engineVersion,
    valuationDate: r.valuationDate,
    currency: r.currency,
    acquisition: { totalCents: r.acquisition.totalCents, totalPctOfPrice: r.acquisition.totalPctOfPrice },
    financing: r.financing && { loanCents: r.financing.loanCents, monthlyPaymentCents: r.financing.monthlyPaymentCents },
    metrics: {
      totalInvestmentCents: m.totalInvestmentCents,
      equityCents: m.equityCents,
      monthlyNoiCents: m.monthlyNoiCents,
      monthlyCashFlowCents: m.monthlyCashFlowCents,
      grossYieldPct: m.grossYieldPct,
      netYieldPct: m.netYieldPct,
      cashOnCashPct: m.cashOnCashPct,
      dscr: m.dscr,
      breakEvenRentCents: m.breakEvenRentCents,
      breakEvenRentPerM2: m.breakEvenRentPerM2,
    },
    rentRegulation: { status: r.rentRegulation.status },
    rentCap: {
      status: r.rentCap.status,
      applicableBaseCents: r.rentCap.applicableBaseCents,
      rentToBasePct: r.rentCap.rentToBasePct,
    },
    tax: {
      method: r.tax.method,
      marginalRatePct: r.tax.marginalRatePct,
      landShare: { pct: r.tax.landShare.pct },
      // Annual figures for years 1 and 3; the full result has years 1 to 5.
      years: r.tax.years
        .filter((y) => y.year === 1 || y.year === 3)
        .map(({ year, resultCents, taxCents, cashFlowAfterTaxCents }) => ({ year, resultCents, taxCents, cashFlowAfterTaxCents })),
      liebhaberei: {
        status: l.status,
        horizonYears: l.horizonYears,
        cumulativeResultCents: l.cumulativeResultCents,
        totalSurplusFromYear: l.totalSurplusFromYear,
      },
    },
    flags: flags(r),
    citations: collectCitations(r),
    assumptionsUsed: r.assumptionsUsed,
    assumptionsDefaulted: r.assumptionsDefaulted,
    limitations: r.limitations,
    disclaimer: r.disclaimer,
  };
}
