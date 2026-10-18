/**
 * Exact money and rate arithmetic.
 *
 * - Money is integer euro cents.
 * - Rates are integer parts per million (1% = 10_000 ppm), so 3.5% or 1.1% are exact.
 * - Products are computed with BigInt so large prices never lose precision.
 *
 * All helpers assume non-negative inputs; callers validate that first.
 */

/** Integer euro cents. */
export type Cents = number;

/** Integer parts per million. 1% = 10_000 ppm, 100% = 1_000_000 ppm. */
export type Ppm = number;

export type Rounding = "halfUp" | "ceil" | "floor";

export const PPM_PER_UNIT = 1_000_000;
const PPM = BigInt(PPM_PER_UNIT);

/** Divides two non-negative bigints with the given rounding. */
export function divRound(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError("divRound expects a non-negative numerator and a positive denominator");
  }
  switch (rounding) {
    case "floor":
      return numerator / denominator;
    case "ceil":
      return (numerator + denominator - 1n) / denominator;
    case "halfUp":
      return (2n * numerator + denominator) / (2n * denominator);
  }
}

/**
 * numerator / denominator rounded to the nearest integer, ties away from zero.
 * Unlike divRound, the numerator may be negative (e.g. a tax saving on a loss).
 */
export function divRoundSigned(numerator: bigint, denominator: bigint): bigint {
  const magnitude = divRound(numerator < 0n ? -numerator : numerator, denominator, "halfUp");
  return numerator < 0n ? -magnitude : magnitude;
}

/** cents × rate, rounded to whole cents. */
export function applyRate(cents: Cents, rate: Ppm, rounding: Rounding): Cents {
  return Number(divRound(BigInt(cents) * BigInt(rate), PPM, rounding));
}

/** Rounds cents up to the next whole euro and returns the euro amount. */
export function ceilToEuros(cents: Cents): number {
  return Number(divRound(BigInt(cents), 100n, "ceil"));
}

/** Converts a euro amount with at most two decimals to cents. Returns undefined if invalid. */
export function eurToCents(eur: number): Cents | undefined {
  if (typeof eur !== "number" || !Number.isFinite(eur)) return undefined;
  const scaled = eur * 100;
  const cents = Math.round(scaled);
  if (Math.abs(scaled - cents) > 1e-6) return undefined;
  if (!Number.isSafeInteger(cents)) return undefined;
  return cents;
}

/** Converts a percentage (e.g. 3.6) with at most four decimals to ppm. Returns undefined if invalid. */
export function pctToPpm(pct: number): Ppm | undefined {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return undefined;
  const scaled = pct * 10_000;
  const ppm = Math.round(scaled);
  if (Math.abs(scaled - ppm) > 1e-6) return undefined;
  return ppm;
}

/**
 * numerator / denominator with the given number of decimals, rounded half away
 * from zero. Works for negative numerators (e.g. a negative cash flow).
 */
export function ratio(numerator: number, denominator: number, decimals = 2): number {
  if (!(denominator > 0)) throw new RangeError("ratio expects a positive denominator");
  const scale = 10n ** BigInt(decimals);
  const magnitude = divRound(BigInt(Math.abs(numerator)) * scale, BigInt(denominator), "halfUp");
  const value = Number(magnitude) / Number(scale);
  return numerator < 0 && value !== 0 ? -value : value;
}

/** numerator / denominator as a percentage with two decimals (e.g. 4.56 for 4.56%). */
export function percent(numerator: number, denominator: number): number {
  return ratio(numerator * 100, denominator, 2);
}

export function centsToEur(cents: Cents): number {
  return cents / 100;
}

/** "€1,234.56" (or "-€1,234.56"). Locale-independent so output is deterministic. */
export function formatEur(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}€${grouped}.${rest}`;
}

/** "3.5%" for 35_000 ppm. */
export function formatPpm(rate: Ppm): string {
  const whole = Math.floor(rate / 10_000);
  const fraction = String(rate % 10_000).padStart(4, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}%` : `${whole}%`;
}
