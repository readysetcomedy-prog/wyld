// Shared pricing helpers for offerings & packages — used by both the owner
// editor (live preview) and the public site (display).

export type BillingPeriod = 'month' | 'week' | 'day' | 'session' | 'one_time';

export const BILLING_PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: 'month', label: 'Per month' },
  { value: 'week', label: 'Per week' },
  { value: 'day', label: 'Per day' },
  { value: 'session', label: 'Per session' },
  { value: 'one_time', label: 'One-time' },
];

const NOUN: Record<BillingPeriod, string> = {
  month: 'month',
  week: 'week',
  day: 'day',
  session: 'session',
  one_time: 'one-time',
};

export function isRecurring(p: BillingPeriod): boolean {
  return p !== 'one_time';
}

export function periodNoun(p: BillingPeriod): string {
  return p === 'one_time' ? 'period' : NOUN[p];
}

// Unit shown next to a price, e.g. "/month". Empty for one-time.
export function periodUnitLabel(p: BillingPeriod): string {
  return p === 'one_time' ? '' : `/${NOUN[p]}`;
}

// e.g. "3 months"
export function countLabel(p: BillingPeriod, n: number): string {
  const noun = periodNoun(p);
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

// e.g. "Pay 3 months upfront"
export function termLabel(p: BillingPeriod, count: number): string {
  return `Pay ${countLabel(p, count)} upfront`;
}

// Counts an owner can pick for a prepay option, scaled to the period.
export function countOptions(p: BillingPeriod): number[] {
  const max = p === 'day' ? 90 : p === 'week' ? 52 : p === 'session' ? 50 : 24;
  return Array.from({ length: max - 1 }, (_, i) => i + 2); // 2..max
}

export function money(cents: number | null | undefined): string {
  return cents != null ? `$${(cents / 100).toFixed(2)}` : '';
}

// Round to at most 2 decimals and drop trailing zeros: 20.00 -> "20",
// 16.666 -> "16.67", 12.50 -> "12.5".
export function trimPercent(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export type TermDiscount = {
  regularCents: number;
  totalCents: number;
  savingCents: number;
  // pct/pctText are null when there's no base price or no real saving.
  pct: number | null;
  pctText: string | null;
  perPeriodCents: number;
};

// Given the base per-period price, how many periods a prepay option covers,
// and its discounted total, work out the regular price, % saved, and the
// effective per-period rate.
export function termDiscount(
  baseCents: number | null,
  count: number,
  totalCents: number
): TermDiscount {
  const perPeriodCents = count > 0 ? Math.round(totalCents / count) : totalCents;
  if (baseCents == null || baseCents <= 0 || count <= 0) {
    return {
      regularCents: totalCents,
      totalCents,
      savingCents: 0,
      pct: null,
      pctText: null,
      perPeriodCents,
    };
  }
  const regularCents = baseCents * count;
  const savingCents = regularCents - totalCents;
  if (savingCents <= 0) {
    return {
      regularCents,
      totalCents,
      savingCents: 0,
      pct: null,
      pctText: null,
      perPeriodCents,
    };
  }
  const pct = (savingCents / regularCents) * 100;
  return {
    regularCents,
    totalCents,
    savingCents,
    pct,
    pctText: trimPercent(pct),
    perPeriodCents,
  };
}
