import { useEffect, useState, useCallback } from 'react';
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
  const [employeeGyms, setEmployeeGyms] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('gym_memberships')
      .select('id, gym_id, status, joined_at, gym:gyms(name, slug, city, state)')
      .eq('member_id', session.user.id)
      .order('joined_at', { ascending: false });
    setRows((data as any) ?? []);
    const { data: emp } = await supabase
      .from('gym_employees')
      .select('gym_id')
      .eq('user_id', session.user.id);
    setEmployeeGyms(new Set(((emp as any) ?? []).map((r: any) => r.gym_id)));
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function leave(m: Membership) {
    if (typeof window !== 'undefined') {
      const tag = employeeGyms.has(m.gym_id)
        ? `Leave ${m.gym.name}? You're an employee here — your employment will remain, but your membership will be removed.`
        : `Leave ${m.gym.name}? This removes your membership at this gym.`;
      if (!window.confirm(tag)) return;
    }
    setErr(null);
    setLeaving(m.id);
    const { error } = await supabase.from('gym_memberships').delete().eq('id', m.id);
    setLeaving(null);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

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

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {rows == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>You&apos;re not a member of any gym yet.</Text>
          <Text style={styles.emptyBody}>
            Find a gym to join, or visit your gym&apos;s website to sign up.
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
          {rows.map((r) => {
            const isEmployee = employeeGyms.has(r.gym_id);
            return (
              <View key={r.id} style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => r.gym.slug && router.push(`/g/${r.gym.slug}` as never)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowName}>{r.gym.name}</Text>
                      {isEmployee ? (
                        <View style={styles.empBadge}>
                          <Text style={styles.empBadgeText}>Employee</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowMeta}>
                      {[r.gym.city, r.gym.state].filter(Boolean).join(', ') || '—'} ·{' '}
                      <Text style={styles.status}>{r.status}</Text>
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
                <Pressable
                  onPress={() => leave(r)}
                  disabled={leaving === r.id}
                  style={styles.leave}
                >
                  <Text style={styles.leaveText}>
                    {leaving === r.id ? 'Leaving…' : 'Leave'}
                  </Text>
                </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  find: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  findText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  err: { color: theme.colors.danger, fontSize: 13 },
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
    alignItems: 'stretch',
    padding: 0,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  rowMeta: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  status: { color: theme.colors.tealDark, fontWeight: '700', textTransform: 'capitalize' },
  chevron: { fontSize: 28, color: theme.colors.textSecondary, lineHeight: 28 },
  empBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.tealDark,
  },
  empBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.4 },
  leave: {
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  leaveText: { color: theme.colors.danger, fontWeight: '700', fontSize: 13 },
});
