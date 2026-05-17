import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useGymSite } from '@/components/GymSiteContext';

type TermOption = { label: string; price_cents: number };
type Offering = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  unit_label: string | null;
  public_blurb: string | null;
  featured: boolean;
  term_options: TermOption[] | null;
};
type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  unit_label: string | null;
  public_blurb: string | null;
  featured: boolean;
  offeringIds: string[];
};

const money = (c: number | null | undefined) =>
  c != null ? `$${(c / 100).toFixed(2)}` : '';

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
          .select('id, name, description, price_cents, unit_label, public_blurb, featured, term_options')
          .eq('gym_id', site.gym.id)
          .eq('published', true)
          .order('display_order'),
        supabase
          .from('gym_packages')
          .select('id, name, description, price_cents, unit_label, public_blurb, featured')
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
  if (offerings.length === 0 && packages.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Memberships and pricing will be listed here soon.
        </Text>
      </View>
    );
  }

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
                    {p.unit_label ? <Text style={styles.unit}>{p.unit_label}</Text> : null}
                  </View>
                  {saving > 0 ? (
                    <Text style={styles.saving}>
                      Save {money(saving)} vs. {money(regular)} separately
                    </Text>
                  ) : null}
                  {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
                  {p.offeringIds.length > 0 ? (
                    <View style={styles.includes}>
                      {p.offeringIds.map((id) =>
                        offeringById[id] ? (
                          <Text key={id} style={styles.includeLine}>
                            ✓ {offeringById[id].name}
                          </Text>
                        ) : null
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {offerings.length > 0 ? (
        <View style={styles.group}>
          {packages.length > 0 ? (
            <Text style={[styles.groupTitle, { color: primary }]}>Memberships &amp; passes</Text>
          ) : null}
          <View style={styles.grid}>
            {offerings.map((o) => (
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
                  {o.unit_label ? <Text style={styles.unit}>{o.unit_label}</Text> : null}
                </View>
                {o.description ? <Text style={styles.desc}>{o.description}</Text> : null}
                {o.term_options && o.term_options.length > 0 ? (
                  <View style={styles.terms}>
                    {o.term_options.map((t, i) => (
                      <View key={i} style={styles.termRow}>
                        <Text style={styles.termLabel}>{t.label}</Text>
                        <Text style={styles.termPrice}>{money(t.price_cents)}</Text>
                      </View>
                    ))}
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
    gap: 4,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  termRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  termLabel: { fontSize: 13, color: '#475569', flex: 1 },
  termPrice: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  empty: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 14, color: '#475569' },
});
