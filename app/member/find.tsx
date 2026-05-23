import { useEffect, useMemo, useState } from 'react';
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

type Gym = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
};

export default function FindGym() {
  const { session } = useAuth();
  const router = useRouter();
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gyms')
        .select('id, name, slug, city, state')
        .neq('slug', 'wyld')
        .order('name');
      setGyms((data as Gym[] | null) ?? []);
    })();
    if (session?.user) {
      (async () => {
        const { data } = await supabase
          .from('gym_memberships')
          .select('gym_id')
          .eq('member_id', session.user.id);
        setMemberOf(new Set((data ?? []).map((m: any) => m.gym_id)));
      })();
    }
  }, [session?.user?.id]);

  const filtered = useMemo(() => {
    if (!gyms) return [];
    const q = search.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter((g) => {
      return (
        g.name.toLowerCase().includes(q) ||
        (g.city ?? '').toLowerCase().includes(q) ||
        (g.state ?? '').toLowerCase().includes(q)
      );
    });
  }, [gyms, search]);

  async function join(gymId: string) {
    if (!session?.user) return;
    setError(null);
    setJoining(gymId);
    const { error } = await supabase
      .from('gym_memberships')
      .insert({ member_id: session.user.id, gym_id: gymId, status: 'active' });
    setJoining(null);
    if (error) {
      setError(error.message);
      return;
    }
    setMemberOf(new Set([...memberOf, gymId]));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find a gym</Text>
      <Text style={styles.sub}>
        Search WyLD partner gyms by name, city, or state. Tap Join for a one-tap signup —
        useful for day passes and visits.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, city, or state"
        placeholderTextColor="#94a3b8"
        style={styles.search}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {gyms == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : filtered.length === 0 ? (
        <Text style={styles.dim}>No matches.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((g) => {
            const isMember = memberOf.has(g.id);
            return (
              <View key={g.id} style={styles.row}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => g.slug && router.push(`/g/${g.slug}` as never)}
                >
                  <Text style={styles.rowName}>{g.name}</Text>
                  <Text style={styles.rowMeta}>
                    {[g.city, g.state].filter(Boolean).join(', ') || '—'}
                  </Text>
                </Pressable>
                {isMember ? (
                  <View style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>Member</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => join(g.id)}
                    disabled={joining === g.id}
                    style={[
                      styles.btn,
                      { backgroundColor: theme.colors.wyldPurple },
                      joining === g.id && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={styles.btnText}>{joining === g.id ? 'Joining…' : 'Join'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
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
