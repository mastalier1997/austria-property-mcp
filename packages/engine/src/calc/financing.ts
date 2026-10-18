import { divRound, type Cents, type Ppm } from "../money.js";

export interface AnnuitySchedule {
  loanCents: Cents;
  /** Nominal annual interest rate in ppm (3.9% = 39_000). */
  ratePpm: Ppm;
  termMonths: number;
  /** Constant monthly payment, rounded half up to the cent. The final payment absorbs rounding. */
  monthlyPaymentCents: Cents;
  year1InterestCents: Cents;
  year1PrincipalCents: Cents;
  balanceAfterYear1Cents: Cents;
  totalInterestCents: Cents;
  /** Interest paid in each loan year (index 0 = year 1), for the tax projection. */
  interestByYearCents: Cents[];
  /** Total payments (interest + principal) in each loan year (index 0 = year 1). */
  paymentByYearCents: Cents[];
}

/** Months per year times one million: monthly rate = annual ppm / this. */
const MONTHLY_DENOMINATOR = 12_000_000n;

/**
 * Monthly annuity payment, computed exactly with rationals:
 *
 *   payment = L · r · (1+r)^n / ((1+r)^n − 1),   r = ratePpm / 12,000,000
 *           = L · ratePpm · A^n / (B · (A^n − B^n)),  A = B + ratePpm, B = 12,000,000
 *
 * No floating point is involved, so the result is identical on every platform.
 */
export function annuityPayment(loanCents: Cents, ratePpm: Ppm, termMonths: number): Cents {
  if (loanCents === 0) return 0;
  const n = BigInt(termMonths);
  if (ratePpm === 0) return Number(divRound(BigInt(loanCents), n, "halfUp"));
  const B = MONTHLY_DENOMINATOR;
  const A = B + BigInt(ratePpm);
  const An = A ** n;
  const Bn = B ** n;
  return Number(divRound(BigInt(loanCents) * BigInt(ratePpm) * An, B * (An - Bn), "halfUp"));
}

/**
 * Full repayment schedule of a constant-rate annuity loan with monthly payments.
 * Interest each month = balance × monthly rate, rounded half up to the cent.
 */
export function annuitySchedule(loanCents: Cents, ratePpm: Ppm, termMonths: number): AnnuitySchedule {
  if (!Number.isInteger(termMonths) || termMonths < 1) throw new RangeError("termMonths must be ≥ 1");
  const payment = annuityPayment(loanCents, ratePpm, termMonths);
  let balance = BigInt(loanCents);
  let totalInterest = 0n;
  let year1Interest = 0n;
  let year1Principal = 0n;
  let balanceAfterYear1 = balance;
  const interestByYear: bigint[] = [];
  const paymentByYear: bigint[] = [];
  for (let month = 1; month <= termMonths; month++) {
    const interest = divRound(balance * BigInt(ratePpm), MONTHLY_DENOMINATOR, "halfUp");
    const yearIndex = Math.floor((month - 1) / 12);
    interestByYear[yearIndex] = (interestByYear[yearIndex] ?? 0n) + interest;
    let principal = BigInt(payment) - interest;
    if (month === termMonths || principal > balance) principal = balance;
    paymentByYear[yearIndex] = (paymentByYear[yearIndex] ?? 0n) + interest + principal;
    balance -= principal;
    totalInterest += interest;
    if (month <= 12) {
      year1Interest += interest;
      year1Principal += principal;
      balanceAfterYear1 = balance;
    }
  }
  return {
    loanCents,
    ratePpm,
    termMonths,
    monthlyPaymentCents: payment,
    year1InterestCents: Number(year1Interest),
    year1PrincipalCents: Number(year1Principal),
    balanceAfterYear1Cents: Number(balanceAfterYear1),
    totalInterestCents: Number(totalInterest),
    interestByYearCents: interestByYear.map(Number),
    paymentByYearCents: paymentByYear.map(Number),
  };
}
