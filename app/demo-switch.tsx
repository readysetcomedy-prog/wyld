import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import {
  useDemoAuthorized,
  useStashedSession,
  switchToDemo,
  returnToSelf,
  setStashedSession,
} from '@/lib/demoMode';
import { Image } from 'react-native';

type DemoAccount = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  gym_name: string | null;
};

// Quick-switcher: lists demo accounts and lets you jump into any one.
// Accessible to authorized users (admin / perm_demo) OR to anyone who has
// a stashed session — that way demo users can bounce between fake accounts
// or get back to themselves from anywhere in the app.
export default function DemoSwitch() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const authorized = useDemoAuthorized(profile?.id);
  const stash = useStashedSession();
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const allowed = authorized === true || !!stash;

  const load = useCallback(async () => {
    if (!allowed) return;
    const { data, error } = await supabase.rpc('wyld_list_demo_accounts');
    if (error) { setErr(error.message); setAccounts([]); return; }
    setAccounts((data as DemoAccount[]) ?? []);
  }, [allowed]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  // Wait for the authorized check to resolve, unless we already have stash access.
  if (authorized === null && !stash) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.wyldPurple} />
      </View>
    );
  }
  if (!allowed) return <Redirect href="/" />;

  const currentEmail = session.user?.email?.toLowerCase() ?? null;

  async function signInAs(acc: DemoAccount) {
    setErr(null);
    setBusy(acc.id);
    try {
      await switchToDemo(acc.email);
      if (typeof window !== 'undefined') window.location.href = '/';
    } catch (e: any) {
      setErr(e?.message ?? 'Sign-in failed');
      setBusy(null);
    }
  }

  async function back() {
    if (!stash) {
      router.back();
      return;
    }
    setErr(null);
    try {
      await returnToSelf();
      // refreshSession replaced the auth state — full reload so every
      // consumer (AuthProvider, cached queries) sees the admin again.
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
      else router.replace('/dashboard' as never);
    } catch (e: any) {
      // Stashed refresh_token rejected (likely an older stash from before
      // we started force-refreshing on switch). Tell the user what's up
      // and offer the manual escape hatch so they aren't stuck in demo.
      setErr(
        `Your saved admin session expired — Supabase rejected the refresh token. ` +
        `Click "Sign out & go to sign-in" to clear it; your next demo switch will ` +
        `stash a fresh token so this won't happen again. (Details: ${e?.message ?? 'unknown'})`,
      );
    }
  }

  async function bailOut() {
    setStashedSession(null);
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') window.location.href = '/sign-in';
    else router.replace('/sign-in' as never);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Demo quick-switch</Text>
          <Text style={styles.sub}>
            {stash
              ? `Signed in as a demo account. Pick another, or return to ${stash.email ?? 'your account'}.`
              : 'Sign in as any demo account. Your real session is stashed so you can return.'}
          </Text>
        </View>
      </View>

      <Pressable style={styles.backBtn} onPress={back}>
        <Text style={styles.backBtnText}>
          {stash ? `← Return to ${stash.email ?? 'my account'}` : '← Back'}
        </Text>
      </Pressable>

      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.err}>{err}</Text>
          <Pressable style={styles.bailBtn} onPress={bailOut}>
            <Text style={styles.bailBtnText}>Sign out & go to sign-in</Text>
          </Pressable>
        </View>
      ) : null}

      {accounts === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : accounts.length === 0 ? (
        <Text style={styles.empty}>
          No demo accounts yet. An admin can seed them from Admin → Testing.
        </Text>
      ) : (
        <View style={styles.grid}>
          {accounts.map((a) => {
            const isCurrent = currentEmail === a.email.toLowerCase();
            return (
              <Pressable
                key={a.id}
                disabled={isCurrent || busy !== null}
                style={[styles.tile, isCurrent && styles.tileCurrent, busy === a.id && styles.tileBusy]}
                onPress={() => signInAs(a)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(a.full_name ?? a.email).split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tileName}>{a.full_name || a.email}</Text>
                  <Text style={styles.tileMeta}>
                    {a.email}
                  </Text>
                  <Text style={styles.tileRole}>
                    {a.role}{a.gym_name ? ` · ${a.gym_name}` : ''}
                  </Text>
                </View>
                {isCurrent ? (
                  <Text style={styles.currentTag}>Current</Text>
                ) : busy === a.id ? (
                  <ActivityIndicator color={theme.colors.wyldPurple} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  header: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  logo: { width: 56, height: 56 },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backBtnText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },
  err: { color: theme.colors.danger, fontSize: 13 },
  errBox: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  bailBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 6, backgroundColor: theme.colors.danger,
  },
  bailBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  empty: { color: theme.colors.textSecondary, fontStyle: 'italic' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    width: 320,
    maxWidth: '100%',
  },
  tileCurrent: { backgroundColor: '#eef2ff', borderColor: theme.colors.wyldPurple },
  tileBusy: { opacity: 0.6 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.wyldPurple,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  tileName: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  tileMeta: { fontSize: 12, color: theme.colors.textSecondary },
  tileRole: { fontSize: 11, color: theme.colors.wyldPurple, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  currentTag: { color: theme.colors.wyldPurple, fontWeight: '800', fontSize: 12 },
});
