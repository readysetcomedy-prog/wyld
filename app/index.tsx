import { Link, Redirect } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme, LOGO_URL } from '@/lib/theme';

export default function Landing() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={[styles.nav, isWide && styles.navWide]}>
        <View style={styles.brand}>
          <Image source={{ uri: LOGO_URL }} style={styles.logoSmall} resizeMode="contain" />
        </View>
        <View style={styles.navLinks}>
          <Link href="/sign-in" asChild>
            <Pressable style={styles.navBtn}>
              <Text style={styles.navBtnText}>Sign in</Text>
            </Pressable>
          </Link>
          <Link href="/sign-up" asChild>
            <Pressable style={[styles.navBtn, styles.navBtnPrimary]}>
              <Text style={[styles.navBtnText, styles.navBtnTextPrimary]}>Get started</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>
            Turnkey gym access.{'\n'}No front desk needed.
          </Text>
          <Text style={styles.heroSub}>
            WyLD Pass lets your members sign up, sign waivers, pay, and walk in — all from
            their phone. You focus on running the gym.
          </Text>
          <View style={styles.heroCtas}>
            <Link href="/sign-up" asChild>
              <Pressable style={[styles.cta, styles.ctaPrimary]}>
                <Text style={styles.ctaPrimaryText}>Get your gym set up</Text>
              </Pressable>
            </Link>
            <Link href="/sign-in" asChild>
              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
        <View style={styles.heroVisual}>
          <Image source={{ uri: LOGO_URL }} style={styles.logoBig} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.features, isWide && styles.featuresWide]}>
        <Feature
          title="Self-serve signups"
          body="Members sign up, pay, and sign waivers themselves — zero staff time."
        />
        <Feature
          title="24/7 access"
          body="Issue digital passes that unlock your doors any hour of the day or night."
        />
        <Feature
          title="Owner dashboard"
          body="See members, revenue, and access logs in one place. Add employees and roles."
        />
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Pass</Text>
    </ScrollView>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: theme.spacing.xxl },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  navWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logoSmall: { width: 48, height: 48 },
  navLinks: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  navBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  navBtnText: { color: theme.colors.charcoal, fontWeight: '600' },
  navBtnPrimary: { backgroundColor: theme.colors.charcoal },
  navBtnTextPrimary: { color: '#fff' },
  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 80,
    gap: theme.spacing.xxl,
  },
  heroText: { flex: 1, gap: theme.spacing.md },
  heroVisual: { flex: 1, alignItems: 'center' },
  logoBig: { width: 280, height: 280 },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.colors.charcoal,
    lineHeight: 48,
  },
  heroSub: { fontSize: 18, color: theme.colors.textSecondary, lineHeight: 28 },
  heroCtas: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    flexWrap: 'wrap',
  },
  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ctaText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 16 },
  ctaPrimary: { backgroundColor: theme.colors.teal, borderColor: theme.colors.teal },
  ctaPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  features: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    flexDirection: 'column',
  },
  featuresWide: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  feature: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.sm,
  },
  featureBody: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },
  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
