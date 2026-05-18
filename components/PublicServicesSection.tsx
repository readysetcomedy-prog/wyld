import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useGymSite } from '@/components/GymSiteContext';
import {
  BillingPeriod,
  periodUnitLabel,
  termLabel,
  termDiscount,
  money,
} from '@/lib/pricing';

// New prepay options carry { count, price_cents }. Legacy rows may instead
// have a free-text { label, price_cents } — still rendered as a plain row.
type TermOption = { count?: number; price_cents: number; label?: string };
type Offering = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  billing_period: BillingPeriod;
  public_blurb: string | null;
  featured: boolean;
  perks: string[] | null;
  term_options: TermOption[] | null;
  location_id: string | null;
};
type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  billing_period: BillingPeriod;
  public_blurb: string | null;
  featured: boolean;
  perks: string[] | null;
  offeringIds: string[];
};

export function PublicServicesSection() {
  const site = useGymSite();
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: o }, { data: p }, { data: links }] = await Promise.all([
        supabase
          .from('gym_offerings')
          .select(
            'id, name, description, price_cents, billing_period, public_blurb, featured, perks, term_options, location_id'
          )
          .eq('gym_id', site.gym.id)
          .eq('published', true)
          .order('display_order'),
        supabase
          .from('gym_packages')
          .select(
            'id, name, description, price_cents, billing_period, public_blurb, featured, perks'
          )
          .eq('gym_id', site.gym.id)
          .eq('published', true)
          .order('display_order'),
        supabase.from('gym_package_offerings').select('package_id, offering_id'),
      ]);
      if (cancelled) return;
      setOfferings((o as Offering[]) ?? []);
      const byPkg: Record<string, string[]> = {};
      (links ?? []).forEach((l: any) => {
        (byPkg[l.package_id] ??= []).push(l.offering_id);
      });
      setPackages(((p as any[]) ?? []).map((row) => ({ ...row, offeringIds: byPkg[row.id] ?? [] })));
    })();
    return () => {
      cancelled = true;
    };
  }, [site.gym.id]);

  const primary = site.theme.primary_color;
  const accent = site.theme.accent_color;

  if (offerings === null) return <ActivityIndicator color={primary} />;

  // Show shared offerings (location_id null) plus the current location's own.
  const visibleOfferings = offerings.filter(
    (o) =>
      o.location_id == null ||
      (site.currentLocation != null && o.location_id === site.currentLocation.id)
  );

  if (visibleOfferings.length === 0 && packages.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Memberships and pricing will be listed here soon.
        </Text>
      </View>
    );
  }

  // Full map (all locations) so packages can resolve every bundled offering.
  const offeringById: Record<string, Offering> = {};
  offerings.forEach((o) => {
    offeringById[o.id] = o;
  });

  return (
    <View style={styles.root}>
      {packages.length > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: primary }]}>Packages</Text>
          <View style={styles.grid}>
            {packages.map((p) => {
              const regular = p.offeringIds.reduce(
                (s, id) => s + (offeringById[id]?.price_cents ?? 0),
                0
              );
              const saving =
                p.price_cents != null && regular > p.price_cents
                  ? regular - p.price_cents
                  : 0;
              return (
                <View
                  key={p.id}
                  style={[styles.card, p.featured && { borderColor: accent, borderWidth: 2 }]}
                >
                  {p.featured ? (
                    <View style={[styles.badge, { backgroundColor: accent }]}>
                      <Text style={styles.badgeText}>Featured</Text>
                    </View>
                  ) : null}
                  <Text style={styles.cardName}>{p.name}</Text>
                  {p.public_blurb ? (
                    <Text style={[styles.blurb, { color: accent }]}>{p.public_blurb}</Text>
                  ) : null}
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: primary }]}>{money(p.price_cents)}</Text>
                    <Text style={styles.unit}>{periodUnitLabel(p.billing_period)}</Text>
                  </View>
                  {saving > 0 ? (
                    <Text style={styles.saving}>
                      Save {money(saving)} vs. {money(regular)} separately
                    </Text>
                  ) : null}
                  {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
                  {p.offeringIds.length > 0 || (p.perks && p.perks.length > 0) ? (
                    <View style={styles.includes}>
                      {p.offeringIds.map((id) =>
                        offeringById[id] ? (
                          <Text key={id} style={styles.includeLine}>
                            ✓ {offeringById[id].name}
                          </Text>
                        ) : null
                      )}
                      {(p.perks ?? []).map((perk, i) => (
                        <Text key={`perk-${i}`} style={styles.includeLine}>
                          ✓ {perk}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {visibleOfferings.length > 0 ? (
        <View style={styles.group}>
          {packages.length > 0 ? (
            <Text style={[styles.groupTitle, { color: primary }]}>Memberships &amp; passes</Text>
          ) : null}
          <View style={styles.grid}>
            {visibleOfferings.map((o) => (
              <View
                key={o.id}
                style={[styles.card, o.featured && { borderColor: accent, borderWidth: 2 }]}
              >
                {o.featured ? (
                  <View style={[styles.badge, { backgroundColor: accent }]}>
                    <Text style={styles.badgeText}>Featured</Text>
                  </View>
                ) : null}
                <Text style={styles.cardName}>{o.name}</Text>
                {o.public_blurb ? (
                  <Text style={[styles.blurb, { color: accent }]}>{o.public_blurb}</Text>
                ) : null}
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: primary }]}>{money(o.price_cents)}</Text>
                  <Text style={styles.unit}>{periodUnitLabel(o.billing_period)}</Text>
                </View>
                {o.description ? <Text style={styles.desc}>{o.description}</Text> : null}
                {o.perks && o.perks.length > 0 ? (
                  <View style={styles.includes}>
                    {o.perks.map((perk, i) => (
                      <Text key={i} style={styles.includeLine}>
                        ✓ {perk}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {o.term_options && o.term_options.length > 0 ? (
                  <View style={styles.terms}>
                    {o.term_options.map((t, i) => {
                      // Legacy free-text option — render as a plain row.
                      if (t.count == null) {
                        return (
                          <View key={i} style={styles.legacyTermRow}>
                            <Text style={styles.termLabel}>{t.label ?? 'Prepay'}</Text>
                            <Text style={styles.termTotal}>{money(t.price_cents)}</Text>
                          </View>
                        );
                      }
                      const d = termDiscount(o.price_cents, t.count, t.price_cents);
                      return (
                        <View key={i} style={styles.term}>
                          <Text style={styles.termLabel}>
                            {termLabel(o.billing_period, t.count)}
                          </Text>
                          <View style={styles.termPriceLine}>
                            {d.pct != null ? (
                              <Text style={styles.termStrike}>{money(d.regularCents)}</Text>
                            ) : null}
                            <Text style={styles.termTotal}>{money(t.price_cents)}</Text>
                            {d.pctText != null ? (
                              <View style={styles.savingTag}>
                                <Text style={styles.savingTagText}>{d.pctText}% off</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.termPer}>
                            {money(d.perPeriodCents)}
                            {periodUnitLabel(o.billing_period)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 28 },
  group: { gap: 14 },
  groupTitle: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    width: 280,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 18,
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 2,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  cardName: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  blurb: { fontSize: 13, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 },
  price: { fontSize: 26, fontWeight: '900' },
  unit: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 4 },
  saving: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  desc: { fontSize: 14, color: '#475569', lineHeight: 20, marginTop: 2 },
  includes: { gap: 3, marginTop: 6 },
  includeLine: { fontSize: 13, color: '#0F172A' },
  terms: {
    gap: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  term: { gap: 2 },
  termLabel: { fontSize: 13, fontWeight: '700', color: '#475569' },
  termPriceLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  termStrike: {
    fontSize: 13,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  termTotal: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  savingTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
  },
  savingTagText: { fontSize: 11, fontWeight: '800', color: '#16a34a' },
  termPer: { fontSize: 12, color: '#64748b' },
  legacyTermRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  empty: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 14, color: '#475569' },
});
