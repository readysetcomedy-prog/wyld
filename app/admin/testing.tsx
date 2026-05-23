import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import {
  DEMO_NAMES,
  emailForName,
  useDemoModeOn,
  switchToDemo,
} from '@/lib/demoMode';

type DemoAccount = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'gym_owner' | 'gym_employee' | 'member';
  gym_id: string | null;
  gym_name: string | null;
  created_at: string;
};

export default function Testing() {
  const [demoOn, setDemoOn] = useDemoModeOn();
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.rpc('wyld_list_demo_accounts');
    if (error) {
      setError(error.message);
      setAccounts([]);
      return;
    }
    setAccounts((data as DemoAccount[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seedAll() {
    setError(null);
    setSeeding(true);
    const payload = DEMO_NAMES.map((n) => ({ email: emailForName(n), full_name: n }));
    const { error } = await supabase.rpc('wyld_seed_demo_accounts', { p_accounts: payload });
    setSeeding(false);
    if (error) { setError(error.message); return; }
    await load();
  }

  async function deleteAll() {
    if (typeof window !== 'undefined' &&
        !window.confirm('Delete ALL demo accounts? This permanently removes every @demo.com user.')) {
      return;
    }
    setError(null);
    setDeleting(true);
    const { error } = await supabase.rpc('wyld_delete_all_demo_accounts');
    setDeleting(false);
    if (error) { setError(error.message); return; }
    await load();
  }

  async function signInAs(acc: DemoAccount) {
    try {
      await switchToDemo(acc.email);
      if (typeof window !== 'undefined') window.location.href = '/';
    } catch (e: any) {
      setError(e?.message ?? 'Sign-in failed');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Testing</Text>
      <Text style={styles.sub}>
        Fake @demo.com accounts for testing. All share the password{' '}
        <Text style={styles.mono}>demo</Text>. Use them as gym owners, employees,
        members — assign roles the normal way through the admin and owner pages.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Demo Accounts On</Text>
            <Text style={styles.cardBody}>
              When on, a floating <Text style={styles.mono}>D</Text> badge appears
              on every page. Click it to open the quick-switcher. Per-browser setting.
            </Text>
          </View>
          <Switch
            value={demoOn}
            onValueChange={setDemoOn}
            trackColor={{ true: theme.colors.wyldPurple, false: '#cbd5e1' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seed accounts</Text>
        <Text style={styles.cardBody}>
          Creates {DEMO_NAMES.length} demo users (auto-confirmed). Idempotent — existing emails are skipped.
        </Text>
        <View style={styles.btnRow}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, seeding && styles.btnDisabled]}
            disabled={seeding}
            onPress={seedAll}
          >
            {seeding ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnPrimaryText}>Seed {DEMO_NAMES.length} accounts</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDanger, deleting && styles.btnDisabled]}
            disabled={deleting}
            onPress={deleteAll}
          >
            {deleting ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnPrimaryText}>Delete all demo accounts</Text>
            )}
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Accounts ({accounts?.length ?? '…'})
        </Text>
        {accounts === null ? (
          <ActivityIndicator color={theme.colors.wyldPurple} />
        ) : accounts.length === 0 ? (
          <Text style={styles.empty}>No demo accounts yet. Click Seed above.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {accounts.map((a) => (
              <View key={a.id} style={styles.acctRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acctName}>{a.full_name || a.email}</Text>
                  <Text style={styles.acctMeta}>
                    {a.email} · {a.role}
                    {a.gym_name ? ` · ${a.gym_name}` : ''}
                  </Text>
                </View>
                <Pressable style={styles.signInBtn} onPress={() => signInAs(a)}>
                  <Text style={styles.signInText}>Sign in as</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.footnote}>
        Grant access to others: on the WyLD employee roster, enable{' '}
        <Text style={styles.mono}>Demo Accounts (WyLD only)</Text> for any staff member.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20, maxWidth: 720 },
  mono: { fontFamily: 'monospace', backgroundColor: '#f1f5f9', paddingHorizontal: 4, borderRadius: 4 },

  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  cardBody: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },

  btnRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  btn: { paddingHorizontal: theme.spacing.md, paddingVertical: 10, borderRadius: theme.radius.md, alignItems: 'center', minWidth: 180 },
  btnPrimary: { backgroundColor: theme.colors.wyldPurple },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },

  error: { color: theme.colors.danger, fontSize: 13 },
  empty: { color: theme.colors.textSecondary, fontStyle: 'italic' },

  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  acctName: { fontWeight: '700', color: theme.colors.charcoal, fontSize: 14 },
  acctMeta: { color: theme.colors.textSecondary, fontSize: 12 },
  signInBtn: {
    backgroundColor: theme.colors.charcoal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  signInText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  footnote: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
});
