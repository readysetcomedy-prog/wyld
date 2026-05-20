// Global pricing model — admin-controlled config that prices every feature,
// plus the engine that turns a gym's modules + counts into a monthly cost.
// Used by the admin Pricing tab (model editor + calculator) and the per-gym
// cost card. Display-only for now: no invoicing, no card charging.

import { supabase } from './supabase';

export type Inclusion = 'paid' | 'included' | 'included_with';

// A rule for 'included_with': the item is free when the gym has ANY of
// `keys` (mode 'any') or ALL of them (mode 'all').
export type IncludedWith = { mode: 'any' | 'all'; keys: string[] };

export type ItemPricing = {
  price_cents: number;
  inclusion: Inclusion;
  // When inclusion is 'included_with', the rule that makes this free.
  included_with: IncludedWith | null;
  // When module `when` is on, this item gets `percent` off. Largest wins.
  discounts: { when: string; percent: number }[];
};

// How a tier group is priced. 'per_unit' charges the matched tier's price
// times the count; 'flat' charges that tier's price as a single flat fee
// for the whole range (tiers are never stacked).
export type TierMode = 'per_unit' | 'flat';

// A count-based pricing tier: an inclusive count range with a price.
// `to_count` null means the range has no upper limit.
export type Tier = {
  from_count: number;
  to_count: number | null;
  price_cents: number;
};

export type PricingModel = {
  items: Record<string, ItemPricing>;
  location_tiers: Tier[];
  location_tier_mode: TierMode;
  member_tiers: Tier[];
  member_tier_mode: TierMode;
  employee_tiers: Tier[];
  employee_tier_mode: TierMode;
};

export type Feature = { key: string; label: string; flag: string | null };

// Features with flag === null are always-on (every gym pays for them). The
// rest map to a gym_modules boolean column.
export const FEATURES: Feature[] = [
  { key: 'base', label: 'Base platform', flag: null },
  { key: 'website', label: 'Website', flag: null },
  { key: 'multi_location_enabled', label: 'Multiple locations', flag: 'multi_location_enabled' },
  { key: 'calendar_enabled', label: 'Calendar / Schedule page', flag: 'calendar_enabled' },
  { key: 'store_enabled', label: 'Store', flag: 'store_enabled' },
  { key: 'news_enabled', label: 'News / Blog', flag: 'news_enabled' },
  { key: 'faq_enabled', label: 'FAQ', flag: 'faq_enabled' },
  { key: 'bookings_enabled', label: 'Bookings', flag: 'bookings_enabled' },
  { key: 'offerings_enabled', label: 'Offerings', flag: 'offerings_enabled' },
  { key: 'employees_enabled', label: 'Employees', flag: 'employees_enabled' },
  { key: 'applications_enabled', label: 'Applications', flag: 'applications_enabled' },
  { key: 'time_cards_enabled', label: 'Time Cards', flag: 'time_cards_enabled' },
  { key: 'door_enabled', label: 'Door Management', flag: 'door_enabled' },
  { key: 'analytics_enabled', label: 'Analytics & Reporting', flag: 'analytics_enabled' },
  { key: 'revenue_expenses_enabled', label: 'Revenue & Expenses', flag: 'revenue_expenses_enabled' },
  { key: 'billing_enabled', label: 'Billing tab', flag: 'billing_enabled' },
  { key: 'marketing_enabled', label: 'Marketing Materials', flag: 'marketing_enabled' },
];

export const FEATURE_LABEL: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.label])
);

export function defaultItem(): ItemPricing {
  return { price_cents: 0, inclusion: 'included', included_with: null, discounts: [] };
}

export const EMPTY_MODEL: PricingModel = {
  items: {},
  location_tiers: [],
  location_tier_mode: 'per_unit',
  member_tiers: [],
  member_tier_mode: 'flat',
  employee_tiers: [],
  employee_tier_mode: 'flat',
};

export function normalizeModel(raw: any): PricingModel {
  const m = raw && typeof raw === 'object' ? raw : {};
  const mode = (v: any, d: TierMode): TierMode =>
    v === 'flat' || v === 'per_unit' ? v : d;
  return {
    items: m.items && typeof m.items === 'object' ? m.items : {},
    location_tiers: Array.isArray(m.location_tiers) ? m.location_tiers : [],
    location_tier_mode: mode(m.location_tier_mode, 'per_unit'),
    member_tiers: Array.isArray(m.member_tiers) ? m.member_tiers : [],
    member_tier_mode: mode(m.member_tier_mode, 'flat'),
    employee_tiers: Array.isArray(m.employee_tiers) ? m.employee_tiers : [],
    employee_tier_mode: mode(m.employee_tier_mode, 'flat'),
  };
}

export async function fetchPricingModel(): Promise<PricingModel> {
  const { data } = await supabase
    .from('pricing_model')
    .select('model')
    .eq('id', 1)
    .maybeSingle();
  return normalizeModel(data?.model);
}

// The tier whose inclusive count range contains the count. When ranges
// overlap, the one with the lowest start wins.
export function tierFor(tiers: Tier[], count: number): Tier | null {
  for (const t of [...tiers].sort((a, b) => a.from_count - b.from_count)) {
    if (count >= t.from_count && (t.to_count == null || count <= t.to_count)) {
      return t;
    }
  }
  return null;
}

export type CostLine = {
  key: string;
  label: string;
  baseCents: number;
  discountPct: number;
  cents: number;
  note: string;
};

export type CostBreakdown = { lines: CostLine[]; totalCents: number };

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Turn a set of active features + counts into an itemized monthly cost.
// `active` holds feature keys that are on (excluding 'base', always counted).
export function computeCost(
  model: PricingModel,
  active: Set<string>,
  locationCount: number,
  memberCount: number,
  employeeCount: number
): CostBreakdown {
  const lines: CostLine[] = [];

  for (const f of FEATURES) {
    const on = f.flag === null || active.has(f.key);
    if (!on) continue;
    const item = model.items[f.key] ?? defaultItem();

    if (item.inclusion === 'included') {
      lines.push({ key: f.key, label: f.label, baseCents: 0, discountPct: 0, cents: 0, note: 'Included' });
      continue;
    }
    if (item.inclusion === 'included_with') {
      const iw = item.included_with;
      const free =
        !!iw &&
        iw.keys.length > 0 &&
        (iw.mode === 'all'
          ? iw.keys.every((k) => active.has(k))
          : iw.keys.some((k) => active.has(k)));
      if (free && iw) {
        const names = iw.keys
          .map((k) => FEATURE_LABEL[k] ?? k)
          .join(iw.mode === 'all' ? ' + ' : ' or ');
        lines.push({
          key: f.key,
          label: f.label,
          baseCents: 0,
          discountPct: 0,
          cents: 0,
          note: `Included with ${names}`,
        });
        continue;
      }
    }

    // Paid (or included_with whose condition isn't met). Apply the single
    // largest qualifying conditional discount.
    let pct = 0;
    let pctFrom = '';
    for (const d of item.discounts ?? []) {
      if (active.has(d.when) && d.percent > pct) {
        pct = d.percent;
        pctFrom = FEATURE_LABEL[d.when] ?? d.when;
      }
    }
    const cents = Math.round(item.price_cents * (1 - pct / 100));
    lines.push({
      key: f.key,
      label: f.label,
      baseCents: item.price_cents,
      discountPct: pct,
      cents,
      note: pct > 0 ? `${pct}% off — has ${pctFrom}` : '',
    });
  }

  // Locations — billed by tier, only when multi-location is on.
  if (active.has('multi_location_enabled') && locationCount > 0) {
    const line = tierLine(
      '__locations',
      'Locations',
      model.location_tiers,
      model.location_tier_mode,
      locationCount
    );
    if (line) lines.push(line);
  }

  // Members — billed by tier (every gym has members).
  if (memberCount > 0) {
    const line = tierLine(
      '__members',
      'Members',
      model.member_tiers,
      model.member_tier_mode,
      memberCount
    );
    if (line) lines.push(line);
  }

  // Employees — billed by tier.
  if (employeeCount > 0) {
    const line = tierLine(
      '__employees',
      'Employees',
      model.employee_tiers,
      model.employee_tier_mode,
      employeeCount
    );
    if (line) lines.push(line);
  }

  return { lines, totalCents: lines.reduce((s, l) => s + l.cents, 0) };
}

// Cost line for a count-based group. In 'flat' mode the matched tier's price
// is the whole charge; in 'per_unit' mode it's that price times the count.
function tierLine(
  key: string,
  label: string,
  tiers: Tier[],
  mode: TierMode,
  count: number
): CostLine | null {
  const t = tierFor(tiers, count);
  if (!t || t.price_cents <= 0) return null;
  const cents = mode === 'flat' ? t.price_cents : t.price_cents * count;
  const range = `${t.from_count}–${t.to_count ?? '∞'}`;
  return {
    key,
    label: `${label} (×${count})`,
    baseCents: cents,
    discountPct: 0,
    cents,
    note: mode === 'flat' ? `Flat rate for ${range}` : `${fmt(t.price_cents)} each`,
  };
}
