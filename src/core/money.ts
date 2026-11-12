/**
 * Exact money arithmetic.
 *
 * - Amounts of money are integers in minor units ("cents").
 * - Hourly rates are integers in "rate units": 1 currency unit = 10 000 rate
 *   units, so rates may carry up to four decimals (e.g. 14.2381 per hour).
 * - Percentages are integers in basis points: 1 % = 100 bp.
 *
 * No floating point number is ever used to carry a monetary value. The only
 * multiplication/division of large operands is done with BigInt and rounded
 * exactly once, at the very end of a calculation.
 */

import type { RoundingMode } from './types';

/** Rate units per whole currency unit. */
export const RATE_SCALE = 10_000;
/** Basis points per 100 %. */
export const BP_SCALE = 10_000;
/** Minor units (cents) per whole currency unit. */
export const MINOR_PER_UNIT = 100;
export const MS_PER_HOUR = 3_600_000;

/**
 * Effective rates are carried as `R = rate units per hour * BP_SCALE`, which keeps
 * percentage premiums exact. cents = R * ms / RATE_TO_CENTS_DENOMINATOR.
 *   R / BP_SCALE            -> rate units per hour
 *   / RATE_SCALE * 100      -> cents per hour
 *   * ms / 3 600 000        -> cents
 */
export const RATE_TO_CENTS_DENOMINATOR = BigInt(BP_SCALE) * BigInt(RATE_SCALE / MINOR_PER_UNIT) * BigInt(MS_PER_HOUR);

/** Integer division of two BigInts, rounded according to `mode` (non-negative operands). */
export function divRoundBig(numerator: bigint, denominator: bigint, mode: RoundingMode = 'nearest'): bigint {
  if (denominator <= BigInt(0)) throw new RangeError('Denominator must be positive');
  const zero = BigInt(0);
  const negative = numerator < zero;
  const n = negative ? -numerator : numerator;
  let q = n / denominator;
  const r = n % denominator;
  if (r !== zero) {
    if (mode === 'up') {
      // Rounding "up" for money means away from zero.
      q += BigInt(1);
    } else if (mode === 'nearest') {
      if (r * BigInt(2) >= denominator) q += BigInt(1); // half rounds away from zero
    }
  }
  return negative ? -q : q;
}

/** Convert a BigInt that is known to be within the safe integer range. */
export function bigToNumber(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError('Amount is too large');
  return n;
}

/** cents = round(R * ms / 3.6e12) where `rateTimesBp` is the effective rate numerator. */
export function centsFromRateNumerator(sumRateTimesMs: bigint): number {
  return bigToNumber(divRoundBig(sumRateTimesMs, RATE_TO_CENTS_DENOMINATOR, 'nearest'));
}

/** Round a duration to a multiple of `unitMs`. `unitMs === 0` leaves it untouched. */
export function roundToUnit(valueMs: number, unitMs: number, mode: RoundingMode): number {
  if (unitMs <= 0) return valueMs;
  if (valueMs <= 0) return 0;
  const q = Math.floor(valueMs / unitMs);
  const r = valueMs - q * unitMs;
  if (r === 0) return valueMs;
  switch (mode) {
    case 'down':
      return q * unitMs;
    case 'up':
      return (q + 1) * unitMs;
    default:
      return r * 2 >= unitMs ? (q + 1) * unitMs : q * unitMs;
  }
}

/**
 * Parse a user-entered decimal ("12", "12.5", "12,50") into an integer scaled by
 * 10^decimals without ever touching floating point. Returns null if invalid.
 */
export function parseDecimal(input: string, decimals: number, allowNegative = false): number | null {
  const s = input.trim().replace(/\s+/g, '');
  if (s === '') return null;
  const match = /^([+-]?)(\d*)(?:[.,](\d*))?$/.exec(s);
  if (!match) return null;
  const sign = match[1] ?? '';
  const whole = match[2] ?? '';
  const frac = match[3] ?? '';
  if (whole === '' && frac === '') return null;
  if (sign === '-' && !allowNegative) return null;
  if (frac.length > decimals) {
    // Allow trailing zeros beyond the precision ("12.500" with 2 decimals) but not real digits.
    if (/[1-9]/.test(frac.slice(decimals))) return null;
  }
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const digits = (whole === '' ? '0' : whole) + fracPadded;
  if (digits.length > 15) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return sign === '-' ? -value : value;
}

/** Inverse of {@link parseDecimal}: 125000 (decimals 4) -> "12.5". Trailing zeros are trimmed down to `minDecimals`. */
export function scaledToDecimalString(value: number, decimals: number, minDecimals = 0, decimalSeparator = '.'): string {
  const negative = value < 0;
  const abs = Math.abs(Math.trunc(value));
  const s = String(abs).padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  let frac = decimals > 0 ? s.slice(s.length - decimals) : '';
  while (frac.length > minDecimals && frac.endsWith('0')) frac = frac.slice(0, -1);
  const out = frac.length > 0 ? `${whole}${decimalSeparator}${frac}` : whole;
  return negative && abs !== 0 ? `-${out}` : out;
}

/** Cents -> display string without currency symbol, e.g. 580 -> "5.80". */
export function centsToPlainString(cents: number, decimalSeparator = '.'): string {
  return scaledToDecimalString(cents, 2, 2, decimalSeparator);
}

/** Rate units -> display decimal with 2..4 decimals, e.g. 120000 -> "12.00", 123457 -> "12.3457". */
export function rateUnitsToPlainString(units: number, decimalSeparator = '.'): string {
  return scaledToDecimalString(units, 4, 2, decimalSeparator);
}

/** Basis points -> percent string, e.g. 5000 -> "50", 1250 -> "12.5". */
export function bpToPercentString(bp: number, decimalSeparator = '.'): string {
  return scaledToDecimalString(bp, 2, 0, decimalSeparator);
}

export function formatMoney(
  cents: number,
  currency: string,
  locale: string,
  options: { signDisplay?: 'auto' | 'always' | 'exceptZero'; hideCents?: boolean } = {},
): string {
  const digits = options.hideCents ? 0 : 2;
  const amount = options.hideCents ? Math.round(cents / MINOR_PER_UNIT) : cents / MINOR_PER_UNIT;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: options.signDisplay ?? 'auto',
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(digits)}`;
  }
}

/** Format an hourly rate (rate units) keeping 2 to 4 decimals. */
export function formatRate(rateUnits: number, currency: string, locale: string): string {
  const amount = rateUnits / RATE_SCALE;
  const significant = rateUnits % 100 !== 0 ? 4 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: significant,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(significant)}`;
  }
}

/** Currency symbol for a currency code in a locale (e.g. "EUR" -> "€"). */
export function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
