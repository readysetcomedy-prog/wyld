import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

type GymRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  custom_domain: string | null;
  owner_name: string | null;
  owner_email: string | null;
};

export default function GymsList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Paginated query. Search hits server-side ilike on name/city/state/slug;
  // owner-name/email are filled in after the page is fetched (owner lookup
  // is one extra query per page, bounded by pageSize).
  const loadPage = useCallback(async (from: number, to: number) => {
    setError(null);
    let q = supabase
      .from('gyms')
      .select('id, name, slug, city, state, custom_domain, owner_id');
    if (debouncedSearch) {
      const p = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`name.ilike.${p},city.ilike.${p},state.ilike.${p},slug.ilike.${p}`);
    }
    const { data, error: qErr } = await q.order('name').range(from, to);
    if (qErr) { setError(qErr.message); return []; }
    const rows = (data ?? []) as any[];
    const ownerIds = Array.from(
      new Set(rows.map((g) => g.owner_id).filter(Boolean) as string[]),
    );
    let ownersById: Record<string, { full_name: string | null; email: string }> = {};
    if (ownerIds.length) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);
      ownersById = Object.fromEntries(
        (owners ?? []).map((o: any) => [o.id, { full_name: o.full_name, email: o.email }]),
      );
    }
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      city: g.city,
      state: g.state,
      custom_domain: g.custom_domain,
      owner_name: g.owner_id ? ownersById[g.owner_id]?.full_name ?? null : null,
      owner_email: g.owner_id ? ownersById[g.owner_id]?.email ?? null : null,
    })) as GymRow[];
  }, [debouncedSearch]);

  const { items: gyms, loading, hasMore, loadMore } = useInfiniteList<GymRow>({
    pageSize: 50,
    load: loadPage,
    deps: [debouncedSearch],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gyms</Text>
        <Text style={styles.subtitle}>
          {gyms ? `${gyms.length} loaded${hasMore ? '+' : ''}` : 'Loading…'}
        </Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, city, state, or slug"
        placeholderTextColor="#94a3b8"
        style={styles.search}
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {gyms == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} style={{ marginTop: 24 }} />
      ) : gyms.length === 0 ? (
        <Text style={styles.empty}>
          {debouncedSearch ? 'No matches.' : 'No gyms yet.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {gyms.map((g) => (
            <Pressable
              key={g.id}
              style={styles.row}
              onPress={() => router.push(`/admin/gyms/${g.id}` as never)}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{g.name}</Text>
                <Text style={styles.rowMeta}>
                  {[g.city, g.state].filter(Boolean).join(', ') || '—'}
                  {g.slug ? `  ·  /${g.slug}` : ''}
                </Text>
                <Text style={styles.rowOwner}>
                  {g.owner_name ?? g.owner_email ?? 'No owner linked'}
                </Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          ))}
          <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md, maxWidth: 960 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  error: { color: theme.colors.danger, fontSize: 14 },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
  list: { gap: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  rowMeta: { fontSize: 13, color: theme.colors.textSecondary },
  rowOwner: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  rowChevron: { fontSize: 28, color: theme.colors.textSecondary, lineHeight: 28 },
});
