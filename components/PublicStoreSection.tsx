import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useGymSite } from '@/components/GymSiteContext';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  image_url: string | null;
  category: string | null;
  featured: boolean;
};

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'price-asc', label: 'Price ↑' },
  { key: 'price-desc', label: 'Price ↓' },
  { key: 'name', label: 'Name' },
];

export function PublicStoreSection() {
  const site = useGymSite();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('featured');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const locFilter = site.currentLocation
        ? `location_id.is.null,location_id.eq.${site.currentLocation.id}`
        : 'location_id.is.null';
      const { data } = await supabase
        .from('gym_products')
        .select('id, name, description, price_cents, currency, image_url, category, featured')
        .eq('gym_id', site.gym.id)
        .eq('published', true)
        .or(locFilter)
        .order('display_order');
      if (!cancelled) setProducts((data as Product[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [site.gym.id, site.currentLocation?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (products ?? []).forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const shown = useMemo(() => {
    let list = [...(products ?? [])];
    if (category) list = list.filter((p) => p.category === category);
    list.sort((a, b) => {
      if (sort === 'featured') {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return 0;
      }
      if (sort === 'name') return a.name.localeCompare(b.name);
      const ap = a.price_cents ?? Infinity;
      const bp = b.price_cents ?? Infinity;
      return sort === 'price-asc' ? ap - bp : bp - ap;
    });
    return list;
  }, [products, category, sort]);

  const primary = site.theme.primary_color;
  const accent = site.theme.accent_color;

  if (products === null) return <ActivityIndicator color={primary} />;
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing in the store yet. Check back soon.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        {categories.length > 0 ? (
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setCategory(null)}
              style={[styles.chip, category === null && { backgroundColor: accent, borderColor: accent }]}
            >
              <Text style={[styles.chipText, category === null && styles.chipTextActive]}>All</Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && { backgroundColor: accent, borderColor: accent }]}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORTS.map((s) => (
            <Pressable key={s.key} onPress={() => setSort(s.key)}>
              <Text
                style={[
                  styles.sortOption,
                  sort === s.key && { color: accent, fontWeight: '800' },
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {shown.map((p) => (
          <View key={p.id} style={styles.card}>
            <View>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imageEmpty]}>
                  <Text style={styles.imageEmptyText}>No image</Text>
                </View>
              )}
              {p.featured ? (
                <View style={[styles.featBadge, { backgroundColor: accent }]}>
                  <Text style={styles.featBadgeText}>★ Featured</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              {p.category ? <Text style={styles.cat}>{p.category}</Text> : null}
              <Text style={styles.name}>{p.name}</Text>
              {p.price_cents != null ? (
                <Text style={[styles.price, { color: primary }]}>
                  ${(p.price_cents / 100).toFixed(2)}
                </Text>
              ) : null}
              {p.description ? (
                <Text style={styles.desc} numberOfLines={4}>{p.description}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  controls: { gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#fff' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  sortLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
  sortOption: { fontSize: 13, color: '#475569', fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    width: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  image: { width: '100%', height: 200 },
  imageEmpty: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  imageEmptyText: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic' },
  featBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  featBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  body: { padding: 14, gap: 5 },
  cat: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  price: { fontSize: 18, fontWeight: '800' },
  desc: { fontSize: 13, color: '#475569', lineHeight: 19 },
  empty: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 14, color: '#475569' },
});
