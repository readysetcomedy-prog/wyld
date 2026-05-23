import { useCallback, useEffect, useRef, useState } from 'react';
import { Slot, Redirect, usePathname, useRouter } from 'expo-router';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { supabase } from '@/lib/supabase';
import { ScrollToTopContext } from '@/lib/scrollContext';

type ModuleKey =
  | 'bookings_enabled'
  | 'store_enabled'
  | 'employees_enabled'
  | 'analytics_enabled'
  | 'door_enabled'
  | 'offerings_enabled'
  | 'billing_enabled'
  | 'marketing_enabled'
  | 'revenue_expenses_enabled'
  | 'applications_enabled'
  | 'schedule_enabled';

type Tab = { label: string; href: string; gated?: ModuleKey };

// Tabs with `gated` only render when the admin has flipped the corresponding
// module flag on for this gym. Always-on tabs (Website, Messages, Calendar,
// Members, Settings) are core and don't need a paid module.
const TABS: Tab[] = [
  { label: 'Billing', href: '/owner/billing', gated: 'billing_enabled' },
  { label: 'Website', href: '/owner/website' },
  { label: 'Messages', href: '/owner/messages' },
  { label: 'Calendar', href: '/owner/calendar' },
  { label: 'Bookings', href: '/owner/bookings', gated: 'bookings_enabled' },
  { label: 'Members', href: '/owner/members' },
  { label: 'Employees', href: '/owner/employees', gated: 'employees_enabled' },
  { label: 'Schedule', href: '/owner/schedule', gated: 'schedule_enabled' },
  { label: 'Applications', href: '/owner/applications', gated: 'applications_enabled' },
  { label: 'Store', href: '/owner/store', gated: 'store_enabled' },
  { label: 'Marketing', href: '/owner/marketing', gated: 'marketing_enabled' },
  { label: 'Analytics & Reporting', href: '/owner/analytics', gated: 'analytics_enabled' },
  { label: 'Revenue & Expenses', href: '/owner/revenue-expenses', gated: 'revenue_expenses_enabled' },
  { label: 'Door Management', href: '/owner/door', gated: 'door_enabled' },
  { label: 'Offerings', href: '/owner/offerings' },
  { label: 'Settings', href: '/owner/settings' },
];

type Brand = { name: string; primary_color: string; accent_color: string; logo_url: string | null };

export default function OwnerLayout() {
  const { session, profile, loading, signOut } = useAuth();
  const unread = useUnreadMessages('owner', profile?.gym_id ?? null);
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const pathname = usePathname();
  const router = useRouter();
  const [modules, setModules] = useState<Record<string, boolean> | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const contentScrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    contentScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useEffect(() => {
    if (!profile?.gym_id) {
      setModules(null);
      setBrand(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: mods }, { data: g }, { data: th }] = await Promise.all([
        supabase
          .from('gym_modules')
          .select(
            'bookings_enabled, store_enabled, employees_enabled, analytics_enabled, door_enabled, offerings_enabled, billing_enabled, marketing_enabled, revenue_expenses_enabled, applications_enabled, schedule_enabled'
          )
          .eq('gym_id', profile.gym_id)
          .maybeSingle(),
        supabase.from('gyms').select('name').eq('id', profile.gym_id).maybeSingle(),
        supabase
          .from('gym_themes')
          .select('primary_color, accent_color, logo_url')
          .eq('gym_id', profile.gym_id)
          .is('location_id', null)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setModules((mods as any) ?? {});
      setBrand({
        name: (g as any)?.name ?? 'My Gym',
        primary_color: (th as any)?.primary_color ?? theme.colors.wyldPurple,
        accent_color: (th as any)?.accent_color ?? theme.colors.tealDark,
        logo_url: (th as any)?.logo_url ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.gym_id]);

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  // Wait for profile to match the current session before role-gating.
  if (!profile || profile.id !== session.user.id) return null;
  if (profile.role !== 'gym_owner' && profile.role !== 'admin') {
    return <Redirect href="/dashboard" />;
  }

  const sidebarBg = brand?.primary_color ?? theme.colors.wyldPurple;
  const accent = brand?.accent_color ?? theme.colors.tealDark;
  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      <View style={[styles.sidebar, isWide && styles.sidebarWide, { backgroundColor: sidebarBg }]}>
        <View style={styles.brand}>
          {brand?.logo_url ? (
            <Image source={{ uri: brand.logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={[styles.logoFallback, { backgroundColor: accent }]}>
              <Text style={styles.logoFallbackText}>
                {(brand?.name ?? 'W').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.brandText}>
            <Text style={styles.brandGym} numberOfLines={1}>
              {brand?.name ?? (profile?.full_name ? `Hi, ${profile.full_name.split(' ')[0]}` : 'My Gym')}
            </Text>
            <Text style={styles.brandRole}>Owner Dashboard</Text>
          </View>
        </View>

        <ScrollView
          horizontal={!isWide}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isWide ? styles.tabsWide : styles.tabsMobile}
        >
          {TABS.filter((t) => !t.gated || modules?.[t.gated] === true).map((tab) => {
            const isActive = pathname === tab.href;
            const badge = tab.href === '/owner/messages' && unread > 0 ? unread : 0;
            return (
              <Pressable
                key={tab.href}
                style={[
                  isWide ? styles.tab : styles.tabMobile,
                  isActive && (isWide
                    ? { backgroundColor: 'rgba(255,255,255,0.18)' }
                    : { backgroundColor: accent, borderColor: accent }),
                ]}
                onPress={() => router.push(tab.href as never)}
              >
                <View style={styles.tabInner}>
                  <Text
                    style={[styles.tabText, isActive && styles.tabTextActive]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {badge > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {isWide ? (
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
            style={styles.signOut}
          >
            <Text style={styles.signOutTextOnDark}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={contentScrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <ScrollToTopContext.Provider value={scrollToTop}>
          <Slot />
        </ScrollToTopContext.Provider>
        {!isWide ? (
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
            style={styles.signOutMobile}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  rootWide: { flexDirection: 'row' },

  sidebar: {
    borderBottomWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sidebarWide: {
    width: 260,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    minHeight: '100%',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  logo: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  logoFallback: {
    width: 44, height: 44, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  logoFallbackText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  brandText: { gap: 2, flex: 1, minWidth: 0 },
  brandGym: { fontSize: 15, fontWeight: '800', color: '#fff' },
  brandRole: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  tabsWide: { flexDirection: 'column', gap: 2 },
  tabsMobile: { flexDirection: 'row', gap: theme.spacing.xs, paddingVertical: theme.spacing.xs },

  tab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  tabMobile: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tabMobileActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  tabTextActive: { color: '#fff' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  signOut: {
    marginTop: 'auto',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
  },
  signOutMobile: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
  },
  signOutText: { color: theme.colors.charcoal, fontWeight: '700' },
  signOutTextOnDark: { color: '#fff', fontWeight: '700' },

  content: { flex: 1 },
  contentInner: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
});
