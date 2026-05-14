import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

type Membership = {
  id: string;
  gym_id: string;
  status: string;
  joined_at: string;
  gym: {
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
  };
};

export default function MyGyms() {
  const { session } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Membership[] | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data } = await supabase
        .from('gym_memberships')
        .select('id, gym_id, status, joined_at, gym:gyms(name, slug, city, state)')
        .eq('member_id', session.user.id)
        .order('joined_at', { ascending: false });
      setRows((data as any) ?? []);
    })();
  }, [session?.user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My gyms</Text>
        <Pressable
          onPress={() => router.push('/member/find' as never)}
          style={[styles.find, { backgroundColor: theme.colors.wyldPurple }]}
        >
          <Text style={styles.findText}>Find another gym</Text>
        </Pressable>
      </View>

      {rows == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>You're not a member of any gym yet.</Text>
          <Text style={styles.emptyBody}>
            Find a gym to join, or visit your gym's website to sign up.
          </Text>
          <Pressable
            onPress={() => router.push('/member/find' as never)}
            style={[styles.find, { backgroundColor: theme.colors.wyldPurple, marginTop: 12 }]}
          >
            <Text style={styles.findText}>Find a gym</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((r) => (
            <Pressable
              key={r.id}
              style={styles.row}
              onPress={() => r.gym.slug && router.push(`/g/${r.gym.slug}` as never)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{r.gym.name}</Text>
                <Text style={styles.rowMeta}>
                  {[r.gym.city, r.gym.state].filter(Boolean).join(', ') || '—'}  ·{' '}
                  <Text style={styles.status}>{r.status}</Text>
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md, maxWidth: 880 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  find: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  findText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },
  emptyBody: { color: theme.colors.textSecondary, textAlign: 'center' },
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
  status: { color: theme.colors.tealDark, fontWeight: '700', textTransform: 'capitalize' },
  chevron: { fontSize: 28, color: theme.colors.textSecondary, lineHeight: 28 },
});
