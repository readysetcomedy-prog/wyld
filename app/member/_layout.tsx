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

const TABS = [
  { label: 'My gyms', href: '/member' },
  { label: 'Find a gym', href: '/member/find' },
  { label: 'Messages', href: '/member/messages' },
  { label: 'Waivers', href: '/member/waivers' },
];

export default function MemberLayout() {
  const { session, loading, signOut, profile } = useAuth();
  const unread = useUnreadMessages('member', null, profile?.id ?? null);
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  // Wait for profile to match the current session before rendering.
  if (!profile || profile.id !== session.user.id) return null;

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      <View style={[styles.sidebar, isWide && styles.sidebarWide]}>
        <View style={styles.brand}>
          <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.brandName}>WyLD</Text>
            <Text style={styles.brandRole}>Member</Text>
          </View>
        </View>
        <ScrollView
          horizontal={!isWide}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isWide ? styles.tabsWide : styles.tabsMobile}
        >
          {TABS.map((t) => {
            const isActive = pathname === t.href;
            const badge = t.href === '/member/messages' && unread > 0 ? unread : 0;
            return (
              <Pressable
                key={t.href}
                style={[
                  isWide ? styles.tab : styles.tabMobile,
                  isActive && (isWide ? styles.tabActive : styles.tabMobileActive),
                ]}
                onPress={() => router.push(t.href as never)}
              >
                <View style={styles.tabInner}>
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {t.label}
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
            style={styles.signOut}
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Slot />
        {!isWide ? (
          <Pressable
            style={styles.signOutMobile}
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
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
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sidebarWide: {
    width: 240,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    minHeight: '100%',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  logo: { width: 44, height: 44 },
  brandName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  brandRole: { fontSize: 11, color: theme.colors.wyldPurple, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },

  tabsWide: { flexDirection: 'column', gap: 2 },
  tabsMobile: { flexDirection: 'row', gap: theme.spacing.xs, paddingVertical: theme.spacing.xs },
  tab: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.md },
  tabActive: { backgroundColor: theme.colors.wyldPurple },
  tabMobile: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabMobileActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
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
  contentInner: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
});
