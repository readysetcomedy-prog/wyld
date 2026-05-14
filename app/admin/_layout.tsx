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

const TABS: { label: string; href: string; match: (p: string) => boolean }[] = [
  { label: 'Gyms', href: '/admin/gyms', match: (p) => p.startsWith('/admin/gyms') },
  { label: 'Users', href: '/admin/users', match: (p) => p === '/admin/users' },
  { label: 'Settings', href: '/admin/settings', match: (p) => p === '/admin/settings' },
];

export default function AdminLayout() {
  const { session, profile, loading, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const pathname = usePathname();
  const router = useRouter();

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'admin') return <Redirect href="/dashboard" />;

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      <View style={[styles.sidebar, isWide && styles.sidebarWide]}>
        <View style={styles.brand}>
          <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.logo} resizeMode="contain" />
          <View style={styles.brandText}>
            <Text style={styles.brandName}>WyLD Inc</Text>
            <Text style={styles.brandRole}>Admin</Text>
          </View>
        </View>

        <ScrollView
          horizontal={!isWide}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isWide ? styles.tabsWide : styles.tabsMobile}
        >
          {TABS.map((tab) => {
            const isActive = tab.match(pathname);
            return (
              <Pressable
                key={tab.href}
                style={[
                  isWide ? styles.tab : styles.tabMobile,
                  isActive && (isWide ? styles.tabActive : styles.tabMobileActive),
                ]}
                onPress={() => router.push(tab.href as never)}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
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

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  logo: { width: 44, height: 44 },
  brandText: { gap: 2 },
  brandName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  brandRole: {
    fontSize: 11,
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

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
