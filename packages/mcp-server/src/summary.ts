/** Short, readable summaries placed before the full JSON in each tool result. */
import {
  formatEur,
  formatPpm,
  type AcquisitionCostsResult,
  type Flag,
  type Rule,
  type UnderwriteResult,
} from "@austria-property/engine";

function flagLines(flags: readonly Flag[]): string[] {
  if (flags.length === 0) return ["Flags: none."];
  return ["Flags:", ...flags.map((f) => `- [${f.severity}] ${f.message}`)];
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${value}%`;
}

export function summariseAcquisition(r: AcquisitionCostsResult): string {
  const rows = r.lineItems.map(
    (l) => `| ${l.labelEn} (${l.labelDe}) | ${formatEur(l.amountCents)} | ${l.citations[0]?.legalBasis ?? "assumption"} |`,
  );
  return [
    `Acquisition costs for a purchase price of ${formatEur(r.purchasePriceCents)} (rules as of ${r.valuationDate}).`,
    "",
    "| Item | Amount | Basis |",
    "|---|---|---|",
    ...rows,
    `| **Total** | **${formatEur(r.totalCents)}** | ${r.totalPctOfPrice}% of the price |`,
    "",
    ...flagLines(r.flags),
    "",
    r.disclaimer,
  ].join("\n");
}

export function summariseUnderwrite(r: UnderwriteResult): string {
  const m = r.metrics;
  const lines: string[] = [
    `Underwriting (rules as of ${r.valuationDate}).`,
    "",
    `Purchase: ${formatEur(r.acquisition.purchasePriceCents)} + acquisition costs ${formatEur(r.acquisition.totalCents)} (${r.acquisition.totalPctOfPrice}%) = ${formatEur(m.totalInvestmentCents)}; equity ${formatEur(m.equityCents)}.`,
  ];
  if (r.financing) {
    const f = r.financing;
    lines.push(
      `Loan: ${formatEur(f.loanCents)} at ${f.ratePct}% over ${f.termYears} years = ${formatEur(f.monthlyPaymentCents)} a month (LTV ${f.ltvPct}%).`,
    );
  } else {
    lines.push("Loan: none (cash purchase).");
  }
  const monthly = r.operating
    .map((l, i) => `${i === 0 ? "" : l.kind === "cost" ? "− " : "+ "}${l.labelEn.toLowerCase()} ${formatEur(l.amountCents)}`)
    .join(" ");
  lines.push(
    `Monthly: ${monthly} = NOI ${formatEur(m.monthlyNoiCents)}; cash flow before tax ${formatEur(m.monthlyCashFlowCents)}.`,
    `Returns: gross yield ${pct(m.grossYieldPct)}, net yield ${pct(m.netYieldPct)}, cash-on-cash ${pct(m.cashOnCashPct)}, DSCR ${m.dscr ?? "n/a"}.`,
    `Break-even rent: ${m.breakEvenRentCents === null ? "not reachable" : formatEur(m.breakEvenRentCents)}${m.breakEvenRentPerM2 === null ? "" : ` (€${m.breakEvenRentPerM2.toFixed(2)} per m²)`}.`,
    `Rent regulation (MRG): ${r.rentRegulation.status}. ${r.rentRegulation.summary}`,
    ...rentCapLine(r),
    ...taxLines(r),
    "",
    ...flagLines(r.flags),
    "",
    r.disclaimer,
  );
  return lines.join("\n");
}

function rentCapLine(r: UnderwriteResult): string[] {
  const c = r.rentCap;
  if (c.status === "noCap") return [];
  if (c.status === "richtwert") {
    return [`Richtwert cap: ${c.explanation} The assumed rent is ${c.rentToBasePct}% of ${formatEur(c.applicableBaseCents ?? 0)}.`];
  }
  return [`Rent cap: ${c.explanation}`];
}

function taxLines(r: UnderwriteResult): string[] {
  const t = r.tax;
  // Half away from zero, like the engine.
  const perMonth = (cents: number) => formatEur(Math.sign(cents) * Math.round(Math.abs(cents) / 12));
  const method =
    t.method === "tariff"
      ? `§ 33 tariff ${t.tariffYear} on ${formatEur(t.otherTaxableIncomeCents ?? 0)} other income, bracket ${t.marginalRatePct}%`
      : `flat ${t.marginalRatePct}% marginal rate`;
  const rows = t.years.map(
    (y) =>
      `| ${y.year} | ${formatEur(y.resultCents)} | ${formatEur(y.taxCents)} | ${perMonth(y.cashFlowAfterTaxCents)} |`,
  );
  const l = t.liebhaberei;
  const liebhaberei =
    l.status === "notChecked"
      ? `Liebhaberei: not checked. ${l.explanation}`
      : `Liebhaberei (${l.horizonYears} years): ${l.status === "totalSurplus" ? `total surplus from year ${l.totalSurplusFromYear}` : "no total surplus"}, cumulative ${formatEur(l.cumulativeResultCents ?? 0)}.`;
  return [
    "",
    `Income tax: ${method}. AfA on ${formatEur(t.afa.buildingCents)} building value (land share ${t.landShare.pct}%), ${t.afa.year1Pct}% in year 1, ${t.afa.year2Pct}% in year 2, then ${t.afa.fromYear3Pct}%.`,
    "",
    "| Year | Rental result | Tax (− = saving) | Cash flow after tax / month |",
    "|---|---|---|---|",
    ...rows,
    "",
    liebhaberei,
  ];
}

export function formatRuleValue(rule: Rule): string {
  switch (rule.unit) {
    case "ppm":
      return formatPpm(rule.value);
    case "cents":
      return formatEur(rule.value);
    case "count":
      return String(rule.value);
    case "date":
      return rule.value;
  }
}
