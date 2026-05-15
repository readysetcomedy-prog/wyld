import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useGymSite } from '@/components/GymSiteContext';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  image_url: string | null;
};

export function PublicStoreSection() {
  const site = useGymSite();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Shared products (location_id null) plus the current location's own.
      const locFilter = site.currentLocation
        ? `location_id.is.null,location_id.eq.${site.currentLocation.id}`
        : 'location_id.is.null';
      const { data } = await supabase
        .from('gym_products')
        .select('id, name, description, price_cents, currency, image_url')
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

  if (products === null) return <ActivityIndicator color={site.theme.primary_color} />;
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Nothing in the store yet. Check back soon.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {products.map((p) => (
        <View key={p.id} style={styles.card}>
          {p.image_url ? (
            <Image source={{ uri: p.image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageEmpty]}>
              <Text style={styles.imageEmptyText}>No image</Text>
            </View>
          )}
          <View style={styles.body}>
            <Text style={styles.name}>{p.name}</Text>
            {p.price_cents != null ? (
              <Text style={[styles.price, { color: site.theme.primary_color }]}>
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
  );
}

const styles = StyleSheet.create({
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
  body: { padding: 14, gap: 6 },
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
