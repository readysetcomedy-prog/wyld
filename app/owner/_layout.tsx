import { useEffect, useState } from 'react';
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
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { supabase } from '@/lib/supabase';

type ModuleKey =
  | 'bookings_enabled'
  | 'store_enabled'
  | 'employees_enabled'
  | 'time_cards_enabled'
  | 'analytics_enabled'
  | 'door_enabled'
  | 'offerings_enabled'
  | 'billing_enabled'
  | 'marketing_enabled';

type Tab = { label: string; href: string; gated?: ModuleKey };

// Tabs with `gated` only render when the admin has flipped the corresponding
// module flag on for this gym. Always-on tabs (Website, Messages, Calendar,
// Members) are core and don't need a paid module.
const TABS: Tab[] = [
  { label: 'Billing', href: '/owner/billing', gated: 'billing_enabled' },
  { label: 'Website', href: '/owner/website' },
  { label: 'Messages', href: '/owner/messages' },
  { label: 'Calendar', href: '/owner/calendar' },
  { label: 'Bookings', href: '/owner/bookings', gated: 'bookings_enabled' },
  { label: 'Members', href: '/owner/members' },
  { label: 'Employees', href: '/owner/employees', gated: 'employees_enabled' },
  { label: 'Time Cards', href: '/owner/time-cards', gated: 'time_cards_enabled' },
  { label: 'Store', href: '/owner/store', gated: 'store_enabled' },
  { label: 'Marketing', href: '/owner/marketing', gated: 'marketing_enabled' },
  { label: 'Analytics & Reporting', href: '/owner/analytics', gated: 'analytics_enabled' },
  { label: 'Door Management', href: '/owner/door', gated: 'door_enabled' },
  { label: 'Offerings', href: '/owner/offerings', gated: 'offerings_enabled' },
];

export default function OwnerLayout() {
  const { session, profile, loading, signOut } = useAuth();
  const unread = useUnreadMessages('owner', profile?.gym_id ?? null);
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const pathname = usePathname();
  const router = useRouter();
  const [modules, setModules] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!profile?.gym_id) {
      setModules(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('gym_modules')
        .select(
          'bookings_enabled, store_enabled, employees_enabled, time_cards_enabled, analytics_enabled, door_enabled, offerings_enabled, billing_enabled, marketing_enabled'
        )
        .eq('gym_id', profile.gym_id)
        .maybeSingle();
      if (!cancelled) setModules((data as any) ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.gym_id]);

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'gym_owner' && profile.role !== 'admin') {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      <View style={[styles.sidebar, isWide && styles.sidebarWide]}>
        <View style={styles.brand}>
          <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.logo} resizeMode="contain" />
          <View style={styles.brandText}>
            <Text style={styles.brandGym}>{profile?.full_name ? `Hi, ${profile.full_name.split(' ')[0]}` : 'Gym Owner'}</Text>
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
                  isActive && (isWide ? styles.tabActive : styles.tabMobileActive),
                ]}
                onPress={() => router.push(tab.href as never)}
              >
                <View style={styles.tabInner}>
                  <Text
                    style={[
                      styles.tabText,
                      isActive && styles.tabTextActive,
                    ]}
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
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Slot />
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
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderRightWidth: 0,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sidebarWide: {
    width: 260,
    borderRightWidth: 1,
    borderBottomWidth: 0,
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
  logo: { width: 44, height: 44 },
  brandText: { gap: 2 },
  brandGym: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  brandRole: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },

  tabsWide: { flexDirection: 'column', gap: 2 },
  tabsMobile: { flexDirection: 'row', gap: theme.spacing.xs, paddingVertical: theme.spacing.xs },

  tab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  tabActive: { backgroundColor: theme.colors.wyldPurple },
  tabMobile: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabMobileActive: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  tabText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
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
    borderColor: theme.colors.border,
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

  content: { flex: 1 },
  contentInner: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
});
