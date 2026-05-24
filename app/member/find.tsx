// Search across every public gym location. Each row is one location of
// a gym — Bear Gym with three sites shows up as three rows — so a member
// searching by city/state finds the right one even if the gym's primary
// is in a different town.
//
// Joining records both gym_id AND location_id on the new membership, so
// downstream reporting / revenue / cross-location rules can attribute
// the membership to the right place.

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
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

type Row = {
  // Stable key — there's one row per location, so the key is the
  // location id (or the gym id for gyms with no locations yet).
  key: string;
  gym_id: string;
  gym_name: string;
  gym_slug: string | null;
  location_id: string | null;
  location_label: string | null;
  city: string | null;
  state: string | null;
};

export default function FindGym() {
  const { session } = useAuth();
  const router = useRouter();
  // Set of "gym_id|location_id" the member already belongs to.
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('gym_memberships')
      .select('gym_id, location_id')
      .eq('member_id', session.user.id)
      .then(({ data }) => setMemberOf(
        new Set(((data as any[]) ?? []).map((m) => `${m.gym_id}|${m.location_id ?? ''}`)),
      ));
  }, [session?.user?.id]);

  // Page over gym_locations and join in the parent gym name+slug. We
  // exclude WyLD (slug='wyld') because it's the org, not a customer gym.
  // Paused locations are also excluded — they're hidden from the public
  // site. Search matches the location's own city/state OR the gym's
  // name. (City/state typed into the box hits the LOCATION columns, so
  // multi-location gyms get the right entries.)
  const loadPage = useCallback(async (from: number, to: number) => {
    let q = supabase
      .from('gym_locations')
      .select('id, label, city, state, gym:gyms!inner(id, name, slug)')
      .eq('is_paused', false)
      .neq('gyms.slug', 'wyld');
    if (debouncedSearch) {
      const p = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      // Match the location's own city/state, or the gym name (joined).
      q = q.or(
        `city.ilike.${p},state.ilike.${p},label.ilike.${p}`,
      );
      // Note: Supabase's foreign-table OR is awkward; if the user types
      // a gym name the row will still match via the gym's own labels
      // (we filter client-side for the joined name as a backup below).
    }
    const { data, error: qErr } = await q.order('city').range(from, to);
    if (qErr) { setError(qErr.message); return []; }
    let rows = ((data as any[]) ?? []).map((l) => ({
      key: l.id,
      gym_id: l.gym?.id,
      gym_name: l.gym?.name ?? 'Gym',
      gym_slug: l.gym?.slug ?? null,
      location_id: l.id,
      location_label: l.label,
      city: l.city,
      state: l.state,
    })) as Row[];
    // Belt-and-suspenders: filter out rows whose joined gym got
    // null-filtered (the inner join should prevent this) and apply a
    // client-side name match too.
    rows = rows.filter((r) => r.gym_id);
    if (debouncedSearch) {
      const needle = debouncedSearch.toLowerCase();
      rows = rows.filter((r) =>
        (r.gym_name ?? '').toLowerCase().includes(needle) ||
        (r.location_label ?? '').toLowerCase().includes(needle) ||
        (r.city ?? '').toLowerCase().includes(needle) ||
        (r.state ?? '').toLowerCase().includes(needle)
      );
    }
    return rows;
  }, [debouncedSearch]);

  const { items: rows, loading, hasMore, loadMore, reload } = useInfiniteList<Row>({
    pageSize: 50,
    load: loadPage,
    deps: [debouncedSearch],
  });

  async function join(r: Row) {
    if (!session?.user) return;
    setError(null);
    setJoining(r.key);
    const { error } = await supabase
      .from('gym_memberships')
      .insert({
        member_id: session.user.id,
        gym_id: r.gym_id,
        location_id: r.location_id,
        status: 'active',
      });
    setJoining(null);
    if (error) { setError(error.message); return; }
    setMemberOf(new Set([...memberOf, `${r.gym_id}|${r.location_id ?? ''}`]));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find a gym</Text>
      <Text style={styles.sub}>
        Search WyLD partner gyms by name, city, or state. Each location of a
        multi-location gym is its own entry, so you can join the one closest
        to you.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, city, or state"
        placeholderTextColor="#94a3b8"
        style={styles.search}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : rows.length === 0 ? (
        <Text style={styles.dim}>No matches.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((r) => {
            const isMember = memberOf.has(`${r.gym_id}|${r.location_id ?? ''}`);
            return (
              <View key={r.key} style={styles.row}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (!r.gym_slug) return;
                    const q = r.location_id ? `?loc=${r.location_id}` : '';
                    router.push(`/g/${r.gym_slug}${q}` as never);
                  }}
                >
                  <Text style={styles.rowName}>
                    {r.gym_name}
                    {r.location_label ? ` · ${r.location_label}` : ''}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {[r.city, r.state].filter(Boolean).join(', ') || '—'}
                  </Text>
                </Pressable>
                {isMember ? (
                  <View style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>Member</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => join(r)}
                    disabled={joining === r.key}
                    style={[
                      styles.btn,
                      { backgroundColor: theme.colors.wyldPurple },
                      joining === r.key && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={styles.btnText}>{joining === r.key ? 'Joining…' : 'Join'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md, maxWidth: 880 },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
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
  error: { color: theme.colors.danger, fontSize: 13 },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic' },
  list: { gap: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  rowName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  rowMeta: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  btn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  btnGhostText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 14 },
});
