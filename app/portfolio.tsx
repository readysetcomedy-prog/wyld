import { Link } from 'expo-router';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { theme, LOGO_URL } from '@/lib/theme';

export default function Portfolio() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={[styles.nav, isWide && styles.navWide]}>
        <Link href="/" asChild>
          <Pressable style={styles.brand}>
            <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
          </Pressable>
        </Link>
        <View style={styles.navLinks}>
          <Link href="/" asChild>
            <Pressable style={styles.navBtn}>
              <Text style={styles.navBtnText}>Home</Text>
            </Pressable>
          </Link>
          <Link href="/sign-up" asChild>
            <Pressable style={StyleSheet.flatten([styles.navBtn, styles.navBtnPrimary])}>
              <Text style={[styles.navBtnText, styles.navBtnTextPrimary]}>Get started</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>Portfolio</Text>
        <Text style={styles.title}>Coming soon.</Text>
        <Text style={styles.bodyText}>
          We're putting together gym sites and rollouts we've built. Check back shortly —
          or get in touch and we'll send you the latest set.
        </Text>
        <Link href="/" asChild>
          <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
            <Text style={styles.ctaPrimaryText}>Back to home</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: theme.spacing.xxl, minHeight: '100%' },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  navWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 96, height: 96 },
  navLinks: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  navBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  navBtnText: { color: theme.colors.charcoal, fontWeight: '600' },
  navBtnPrimary: { backgroundColor: theme.colors.charcoal },
  navBtnTextPrimary: { color: '#fff' },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  eyebrow: {
    color: theme.colors.teal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.colors.charcoal,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 24,
  },
  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  ctaPrimary: { backgroundColor: theme.colors.teal, borderColor: theme.colors.teal },
  ctaPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
