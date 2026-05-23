// Per-gym member dashboard chrome. Wraps the gym's sub-pages with sidebar
// tabs themed in the gym's primary color + logo so the member knows which
// gym they're inside. Visible to anyone who's an active member or active
// employee at this gym; everyone else is bounced.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Image, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Slot, Redirect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme as wyldTheme } from '@/lib/theme';

type Tab = { label: string; href: (gymId: string) => string; employeesOnly?: boolean };

const TABS: Tab[] = [
  { label: 'Overview', href: (g) => `/m/${g}` },
  { label: 'Messages', href: (g) => `/m/${g}/messages` },
  { label: 'Waivers', href: (g) => `/m/${g}/waivers` },
  { label: 'Membership Billing', href: (g) => `/m/${g}/billing` },
  { label: 'Schedule', href: (g) => `/m/${g}/schedule`, employeesOnly: true },
  { label: 'Employee Profile', href: (g) => `/m/${g}/employee`, employeesOnly: true },
];

type GymBrand = {
  name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
};

export default function MemberGymLayout() {
  const { session, profile, loading: authLoading } = useAuth();
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const [gym, setGym] = useState<GymBrand | null>(null);
  const [resolved, setResolved] = useState<
    | { state: 'loading' }
    | { state: 'denied' }
    | { state: 'ok'; isEmployee: boolean }
  >({ state: 'loading' });

  const load = useCallback(async () => {
    if (!session || !gymId) return;
    const [{ data: g }, { data: th }, { data: mem }, { data: emp }] = await Promise.all([
      supabase.from('gyms').select('name, owner_id, slug').eq('id', gymId).maybeSingle(),
      supabase.from('gym_themes').select('primary_color, accent_color, logo_url').eq('gym_id', gymId).is('location_id', null).maybeSingle(),
      supabase.from('gym_memberships').select('id').eq('gym_id', gymId).eq('member_id', session.user.id).maybeSingle(),
      supabase.from('gym_employees').select('id, terminate_date').eq('gym_id', gymId).or(`user_id.eq.${session.user.id},email.eq.${profile?.email ?? ''}`).maybeSingle(),
    ]);

    if (!g) { setResolved({ state: 'denied' }); return; }
    // WyLD itself is not a gym dashboard — the WyLD employee experience
    // lives inside the regular /member portal.
    if ((g as any).slug === 'wyld') { setResolved({ state: 'denied' }); return; }

    const empActive = emp && (!(emp as any).terminate_date || (emp as any).terminate_date > new Date().toISOString().slice(0, 10));
    const hasAccess = !!mem || empActive || (g as any).owner_id === session.user.id || profile?.role === 'admin';
    if (!hasAccess) { setResolved({ state: 'denied' }); return; }

    setGym({
      name: (g as any).name,
      logo_url: (th as any)?.logo_url ?? null,
      primary_color: (th as any)?.primary_color ?? wyldTheme.colors.wyldPurple,
      accent_color: (th as any)?.accent_color ?? wyldTheme.colors.tealDark,
    });
    setResolved({ state: 'ok', isEmployee: !!empActive });
  }, [session, gymId, profile?.email, profile?.role]);

  useEffect(() => { load(); }, [load]);

  if (authLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile || profile.id !== session.user.id) return null;
  if (!gymId) return <Redirect href="/member/profile" />;

  if (resolved.state === 'loading' || !gym) {
    return <View style={styles.center}><ActivityIndicator color={wyldTheme.colors.wyldPurple} /></View>;
  }
  if (resolved.state === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>You're not a member of this gym.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/member/profile' as never)}>
          <Text style={styles.backBtnText}>Back to my profile</Text>
        </Pressable>
      </View>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.employeesOnly || resolved.isEmployee);

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      <View style={[styles.sidebar, isWide && styles.sidebarWide, { backgroundColor: gym.primary_color }]}>
        <Pressable style={styles.brand} onPress={() => router.replace('/member/profile' as never)}>
          {gym.logo_url ? (
            <Image source={{ uri: gym.logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={[styles.logoFallback, { backgroundColor: gym.accent_color }]}>
              <Text style={styles.logoFallbackText}>{gym.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brandName} numberOfLines={1}>{gym.name}</Text>
            <Text style={styles.brandRole}>Member dashboard</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.backRow}
          onPress={() => router.replace('/member/profile' as never)}
        >
          <Text style={styles.backRowText}>← My profile</Text>
        </Pressable>

        <ScrollView
          horizontal={!isWide}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isWide ? styles.tabsWide : styles.tabsMobile}
        >
          {visibleTabs.map((t) => {
            const href = t.href(gymId);
            const isActive = pathname === href;
            return (
              <Pressable
                key={href}
                onPress={() => router.push(href as never)}
                style={[
                  isWide ? styles.tab : styles.tabMobile,
                  isActive && (isWide
                    ? { backgroundColor: 'rgba(255,255,255,0.18)' }
                    : { backgroundColor: gym.accent_color, borderColor: gym.accent_color }),
                ]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Slot />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: wyldTheme.colors.background },
  rootWide: { flexDirection: 'row' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  deniedTitle: { fontSize: 16, fontWeight: '800', color: wyldTheme.colors.charcoal },
  backBtn: { backgroundColor: wyldTheme.colors.wyldPurple, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  sidebar: {
    paddingHorizontal: wyldTheme.spacing.md,
    paddingVertical: wyldTheme.spacing.md,
    gap: wyldTheme.spacing.sm,
  },
  sidebarWide: {
    width: 260,
    paddingHorizontal: wyldTheme.spacing.lg,
    paddingVertical: wyldTheme.spacing.lg,
    minHeight: '100%',
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoFallback: {
    width: 44, height: 44, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  logoFallbackText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  brandName: { color: '#fff', fontWeight: '800', fontSize: 16 },
  brandRole: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  backRow: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    alignSelf: 'flex-start',
  },
  backRowText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },

  tabsWide: { flexDirection: 'column', gap: 2, marginTop: 8 },
  tabsMobile: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  tabMobile: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tabText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#fff' },

  content: { flex: 1 },
  contentInner: { padding: wyldTheme.spacing.lg, paddingBottom: wyldTheme.spacing.xxl },
});
